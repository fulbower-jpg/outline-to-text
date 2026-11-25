(function () {
  var cs = new CSInterface();
  var fs = require('fs'), path = require('path'), http = require('http');
  var ROOT = cs.getSystemPath(SystemPath.EXTENSION);
  var $ = function (id) { return document.getElementById(id); };
  var logEl = $('log');
  function log(m) { logEl.textContent += '\n' + m; logEl.scrollTop = logEl.scrollHeight; }
  function jsx(code) { return new Promise(function (r) { cs.evalScript(code, r); }); }
  function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }

  // ---- tiny local server so the OCR worker, wasm and language data load over http ----
  var serverPort = null;
  function startServer() {
    return new Promise(function (resolve) {
      var libDir = path.join(ROOT, 'lib');
      var srv = http.createServer(function (req, res) {
        var f = path.join(libDir, decodeURIComponent(req.url.split('?')[0]).replace(/\.\./g, ''));
        fs.readFile(f, function (err, data) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          if (err) { res.statusCode = 404; return res.end(); }
          res.setHeader('Content-Type', /\.js$/.test(f) ? 'application/javascript' : 'application/octet-stream');
          res.end(data);
        });
      });
      srv.listen(0, '127.0.0.1', function () { serverPort = srv.address().port; resolve(); });
    });
  }

  // ---- fonts ----
  var families = {};   // family -> {regular: ps, bold: ps}
  var SKIP = /(dings|symbol|wing|emoji|icon|marlett|webdings|ornament|barcode|braille|music)/i;
  async function loadFonts() {
    var raw = await jsx('otx_listFonts()');
    raw.split('\n').forEach(function (line) {
      var p = line.split('\t'); if (p.length < 3) return;
      var fam = p[0], style = p[1], ps = p[2];
      if (SKIP.test(fam)) return;
      var e = families[fam] || (families[fam] = {});
      if (/^(regular|roman|book|normal|plain)$/i.test(style)) e.regular = ps;
      else if (/^bold$/i.test(style)) e.bold = ps;
    });
    Object.keys(families).forEach(function (k) { if (!families[k].regular) delete families[k]; });
    var sel = $('fontFamily'); sel.innerHTML = '';
    Object.keys(families).sort().forEach(function (k) {
      var o = document.createElement('option'); o.value = k; o.textContent = k; sel.appendChild(o);
    });
  }
  $('fontMode').onchange = function () { $('fontFamily').style.display = this.value === 'fixed' ? 'block' : 'none'; };

  // ---- image helpers ----
  function loadImage(p) {
    return new Promise(function (res, rej) {
      var blob = new Blob([fs.readFileSync(p)], { type: 'image/png' });
      var img = new Image(); img.onload = function () { res(img); }; img.onerror = rej;
      img.src = URL.createObjectURL(blob);
    });
  }
  function maskOf(ctx, w, h) {
    var d = ctx.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
    for (var i = 0; i < m.length; i++) m[i] = d[i * 4] < 128 ? 1 : 0;
    return m;
  }

  // Render `text` in a candidate font stretched to the target ink width and compare to the target mask.
  var rc = document.createElement('canvas'), rctx = rc.getContext('2d', { willReadFrequently: true });
  function renderScore(line, cand) {
    var W = line.mw, H = line.mh;
    rc.width = W; rc.height = H;
    rctx.fillStyle = '#fff'; rctx.fillRect(0, 0, W, H);
    rctx.fillStyle = '#000'; rctx.textBaseline = 'alphabetic';
    var fam = '"' + cand.fam + '"';
    rctx.font = cand.weight + ' 100px ' + fam;
    var m = rctx.measureText(line.text);
    var inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    if (!(inkW > 0)) return { score: 0, ascent: 0 };
    var size = 100 * W / inkW;
    rctx.font = cand.weight + ' ' + size + 'px ' + fam;
    var m2 = rctx.measureText(line.text);
    rctx.fillText(line.text, m2.actualBoundingBoxLeft, m2.actualBoundingBoxAscent);
    var a = maskOf(rctx, W, H), b = line.mask, inter = 0, uni = 0;
    for (var i = 0; i < a.length; i++) {
      var x = a[i], y = b[i];
      if (x & y) inter++;
      if (x | y) uni++;
    }
    return { score: uni ? inter / uni : 0, ascent: m2.actualBoundingBoxAscent / line.k };
  }

  function candidates(onlyFamily) {
    var out = [];
    Object.keys(families).forEach(function (fam) {
      if (onlyFamily && fam !== onlyFamily) return;
      out.push({ fam: fam, weight: 400, ps: families[fam].regular });
      if (families[fam].bold) out.push({ fam: fam, weight: 700, ps: families[fam].bold });
    });
    return out;
  }

  // ---- main ----
  var MIN_SCORE = 0.45;   // average shape-overlap needed to call a font a real match
  var pending = null;

  async function build(pd) {
    log('Building live text…');
    var out = [pd.L + '|' + pd.T + '|' + pd.pad + '|' + pd.scale + '|' + $('orig').value];
    pd.lines.forEach(function (l, i) {
      var baseline = l.bb.y0 + (pd.choice[i].ascent || (l.bb.y1 - l.bb.y0) * 0.8);
      out.push([l.bb.x0, baseline.toFixed(2), l.bb.x1 - l.bb.x0, pd.choice[i].cand.ps, l.text].join('|'));
    });
    var done = await jsx('otx_apply(' + JSON.stringify(out.join('\n')).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + ')');
    if (done.indexOf('OK|') !== 0) throw new Error(done.replace(/^ERR:/, ''));
    var d = done.split('|');
    log('Done: ' + d[1] + ' text line(s) created' + (+d[2] ? ', ' + d[2] + ' failed' : '') + '. Check spelling, OCR can slip.');
  }

  $('fallback').onclick = async function () {
    if (!pending) return;
    $('fallback').style.display = 'none'; $('go').disabled = true;
    try { await build(pending); } catch (e) { log('Error: ' + (e && e.message ? e.message : e)); }
    pending = null; $('go').disabled = false;
  };
  async function run() {
    $('go').disabled = true; logEl.textContent = ''; $('fallback').style.display = 'none'; pending = null;
    try {
      log('Capturing selection…');
      var r = await jsx('otx_prepare()');
      if (r.indexOf('OK|') !== 0) throw new Error(r.replace(/^ERR:/, ''));
      var p = r.split('|'), png = p[1], L = p[2], T = p[3], pad = p[4], scale = p[5];

      var img = await loadImage(png);
      var cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      var cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);

      log('Reading text (OCR)…');
      var base = 'http://127.0.0.1:' + serverPort;
      var worker = await Tesseract.createWorker({
        workerPath: base + '/worker.min.js', corePath: base + '/tesseract-core.wasm.js',
        langPath: base + '/lang', cacheMethod: 'none'
      });
      await worker.loadLanguage('eng'); await worker.initialize('eng');
      var res = await worker.recognize(cv);
      await worker.terminate();

      var lines = [];
      (res.data.lines || []).forEach(function (l) {
        var t = (l.text || '').replace(/\s+/g, ' ').trim();
        if (!t || l.confidence < 35) return;
        var bb = l.bbox, bw = bb.x1 - bb.x0, bh = bb.y1 - bb.y0;
        if (bw < 4 || bh < 4) return;
        var k = Math.min(1, 320 / bw), mw = Math.max(1, Math.round(bw * k)), mh = Math.max(1, Math.round(bh * k));
        var tc = document.createElement('canvas'); tc.width = mw; tc.height = mh;
        var tx = tc.getContext('2d', { willReadFrequently: true });
        tx.fillStyle = '#fff'; tx.fillRect(0, 0, mw, mh);
        tx.drawImage(cv, bb.x0, bb.y0, bw, bh, 0, 0, mw, mh);
        lines.push({ text: t, bb: bb, k: k, mw: mw, mh: mh, mask: maskOf(tx, mw, mh) });
      });
      if (!lines.length) throw new Error('No text found. Is the selection actually outlined letters?');
      log('Found ' + lines.length + ' line(s). Matching fonts…');
      await tick();

      var mode = $('fontMode').value;
      var cands = candidates(mode === 'fixed' ? $('fontFamily').value : null);
      if (!cands.length) throw new Error('No usable fonts found.');
      var choice = [];   // per line: {cand, ascent}
      var avgScore = 0;

      if ($('oneFont').checked || cands.length === 2 || mode === 'fixed' && cands.length <= 2) {
        var probe = lines.slice().sort(function (a, b) { return b.text.length - a.text.length; }).slice(0, 12);
        var best = null;
        for (var ci = 0; ci < cands.length; ci++) {
          var s = 0; probe.forEach(function (l) { s += renderScore(l, cands[ci]).score; });
          if (!best || s > best.s) best = { s: s, c: cands[ci] };
          if (ci % 25 === 0) await tick();
        }
        avgScore = best.s / probe.length;
        log('Closest font: ' + best.c.fam + (best.c.weight === 700 ? ' Bold' : ''));
        lines.forEach(function (l) { choice.push({ cand: best.c, ascent: renderScore(l, best.c).ascent }); });
      } else {
        for (var li = 0; li < lines.length; li++) {
          var bl = null;
          for (var cj = 0; cj < cands.length; cj++) {
            var rr = renderScore(lines[li], cands[cj]);
            if (!bl || rr.score > bl.score) bl = { score: rr.score, cand: cands[cj], ascent: rr.ascent };
          }
          choice.push(bl); avgScore += bl.score / lines.length; await tick();
        }
      }

      pending = { lines: lines, choice: choice, L: L, T: T, pad: pad, scale: scale };
      if (avgScore < MIN_SCORE) {
        log('No close font match found (best guess: ' + choice[0].cand.fam + ').');
        log('Press "Convert anyway" to make editable text in that font, or pick a font above and run again.');
        $('fallback').style.display = 'block';
      } else {
        await build(pending); pending = null;
      }
    } catch (e) {
      log('Error: ' + (e && e.message ? e.message : e));
    }
    $('go').disabled = false;
  }

  $('go').disabled = true;
  Promise.all([startServer(), loadFonts()]).then(function () { $('go').disabled = false; $('go').onclick = run; })
    .catch(function (e) { log('Startup error: ' + e); });
})();
