// Outline to Text - Illustrator side (ExtendScript, ES3)

function otx_listFonts() {
  var out = [];
  for (var i = 0; i < app.textFonts.length; i++) {
    var f = app.textFonts[i];
    out.push(f.family + "\t" + f.style + "\t" + f.name);
  }
  return out.join("\n");
}

function otx_firstFill(item) {
  try {
    if (item.typename == "PathItem") { if (item.filled) return item.fillColor; }
    else if (item.typename == "CompoundPathItem") { return otx_firstFill(item.pathItems[0]); }
    else if (item.typename == "GroupItem") {
      for (var i = 0; i < item.pageItems.length; i++) {
        var c = otx_firstFill(item.pageItems[i]); if (c) return c;
      }
    }
  } catch (e) {}
  return null;
}

function otx_blacken(item) {
  var t = item.typename;
  if (t == "GroupItem") {
    for (var i = item.pageItems.length - 1; i >= 0; i--) otx_blacken(item.pageItems[i]);
  } else if (t == "CompoundPathItem") {
    var k = new RGBColor(); k.red = 0; k.green = 0; k.blue = 0;
    try { item.pathItems[0].fillColor = k; item.pathItems[0].stroked = false; } catch (e) {}
  } else if (t == "PathItem") {
    var b = new RGBColor(); b.red = 0; b.green = 0; b.blue = 0;
    try { item.filled = true; item.fillColor = b; item.stroked = false; } catch (e) {}
  } else {
    try { item.remove(); } catch (e2) {}   // rasters, placed files, meshes, live text
  }
}

// Copies the selection into a temp doc, flattens it to black-on-white, exports a PNG.
function otx_prepare() {
  try {
    if (app.documents.length == 0) return "ERR:No document open.";
    var src = app.activeDocument;
    var sel = src.selection;
    if (!sel || sel.length == 0) return "ERR:Select the outlined text first.";

    var items = [], i;
    for (i = 0; i < sel.length; i++) items.push(sel[i]);
    $.global.OTX_SRC = src;
    $.global.OTX_SEL = items;
    $.global.OTX_COLOR = null;
    for (i = 0; i < items.length && !$.global.OTX_COLOR; i++) $.global.OTX_COLOR = otx_firstFill(items[i]);

    var L = 1e9, T = -1e9, R = -1e9, B = 1e9;
    for (i = 0; i < items.length; i++) {
      var g = items[i].geometricBounds; // [left, top, right, bottom]
      if (g[0] < L) L = g[0]; if (g[1] > T) T = g[1];
      if (g[2] > R) R = g[2]; if (g[3] < B) B = g[3];
    }
    var w = R - L, h = T - B, pad = 10;

    app.copy();
    var tmp = app.documents.add(DocumentColorSpace.RGB, w + pad * 2, h + pad * 2);
    var ab = tmp.artboards[0].artboardRect; // [l, t, r, b]
    app.paste();
    try { app.executeMenuCommand("group"); } catch (e) {}
    var grp = tmp.selection[0];
    grp.position = [ab[0] + pad, ab[1] - pad];
    otx_blacken(grp);

    var bg = tmp.pathItems.rectangle(ab[1], ab[0], ab[2] - ab[0], ab[1] - ab[3]);
    var white = new RGBColor(); white.red = 255; white.green = 255; white.blue = 255;
    bg.fillColor = white; bg.stroked = false;
    bg.zOrder(ZOrderMethod.SENDTOBACK);

    var scale = Math.max(100, Math.min(800, 4000 / Math.max(w, h) * 100));
    var f = new File(Folder.temp + "/otx_capture.png");
    var o = new ExportOptionsPNG24();
    o.antiAliasing = true; o.transparency = false; o.artBoardClipping = true;
    o.horizontalScale = scale; o.verticalScale = scale;
    tmp.exportFile(f, ExportType.PNG24, o);
    tmp.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = src;

    return "OK|" + f.fsName + "|" + L + "|" + T + "|" + pad + "|" + scale;
  } catch (err) {
    try { app.activeDocument = $.global.OTX_SRC; } catch (e3) {}
    return "ERR:" + err;
  }
}

function otx_inkWidth(tf) {
  var o = tf.duplicate().createOutline();
  var r = { w: o.width, left: o.left };
  o.remove();
  return r;
}

// payload: header "L|T|pad|scale|mode" then lines "x|baselineY|width|fontPS|text" (pixels)
function otx_apply(s) {
  try {
    var lines = s.split("\n");
    var h = lines[0].split("|");
    var L = +h[0], T = +h[1], pad = +h[2], sc = +h[3] / 100, mode = h[4];
    var doc = $.global.OTX_SRC;
    app.activeDocument = doc;
    var made = 0, fail = 0;

    for (var i = 1; i < lines.length; i++) {
      var ln = lines[i];
      if (!ln) continue;
      var p = ln.split("|");
      var x = +p[0], by = +p[1], wpx = +p[2], ps = p[3];
      var text = ln.substring(p[0].length + p[1].length + p[2].length + p[3].length + 4);
      try {
        var targetLeft = L + x / sc - pad;
        var targetBase = T - (by / sc - pad);
        var targetW = wpx / sc;

        var tf = doc.textFrames.add();
        tf.contents = text;
        var ca = tf.textRange.characterAttributes;
        try { ca.textFont = app.textFonts.getByName(ps); } catch (e) {}
        ca.size = 100;
        if ($.global.OTX_COLOR) { try { ca.fillColor = $.global.OTX_COLOR; } catch (e) {} }

        var m = otx_inkWidth(tf);
        ca.size = Math.max(1, Math.min(1296, 100 * targetW / m.w));
        var m2 = otx_inkWidth(tf);
        var a = tf.anchor;
        tf.translate(targetLeft - m2.left, targetBase - a[1]);
        made++;
      } catch (e2) { fail++; }
    }

    var items = $.global.OTX_SEL || [];
    if (made > 0 && mode != "keep") {
      for (var j = items.length - 1; j >= 0; j--) {
        try { if (mode == "delete") items[j].remove(); else items[j].hidden = true; } catch (e3) {}
      }
    }
    return "OK|" + made + "|" + fail;
  } catch (err) {
    return "ERR:" + err;
  }
}
