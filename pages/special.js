// --- SVG LocalStorage applicator (drop into your page's JS, near end of body) ---
(function () {
  // map normalized field names -> SVG element IDs (edit IDs here to match your SVG)
  const ID_MAP = {
    firstName: "firstName",
    middleName: "middleName",
    lastName: "lastName",
    fullName: "fullName", // if you added a single fullName id
    classSec: "classSec",
    classRoll: "classRoll",
    stuEmail: "email", // your SVG id for email is 'email' in exp7out.html
    age: "age",
    space: " ",
  };

  // Read + tolerant parse of localStorage.studentUser
  function readStudentUser() {
    const raw = localStorage.getItem("studentUser");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      // Try light normalization of single-quoted Python/dict style
      try {
        const normalized = raw
          .replace(/(['"])?([A-Za-z0-9 _\-]+)\1\s*:/g, '"$2":') // quote keys
          .replace(/:\s*'([^']*)'/g, ':"$1"'); // convert 'value' to "value"
        return JSON.parse(normalized);
      } catch (e) {
        console.warn("studentUser parse failed", e);
        return null;
      }
    }
  }

  // Build a normalized values object we'll write into the SVG
  function buildValues(obj) {
    if (!obj) return null;
    const full = [
      obj["First Name"] || obj.firstName,
      obj["Middle Name"] || obj.middleName,
      obj["Last Name"] || obj.lastName,
    ]
      .filter(Boolean)
      .join(" ");
    return {
      firstName: obj["First Name"] || obj.firstName || "",
      middleName: obj["Middle Name"] || obj.middleName || "",
      lastName: obj["Last Name"] || obj.lastName || "",
      fullName: full || obj.fullName || "",
      classSec: obj.section || obj.classSec || "",
      classRoll: obj.rollNum || obj.roll || obj.rollNumber || "",
      stuEmail: obj.email || obj.Email || obj.stuEmail || "",
      collegeName: obj["Collage Name"] || obj.college || "",
      age: obj.Age || obj.age || "",
      space: " ",
      marks_bee:
        (obj.Marks && obj.Marks.BEE) || (obj.marks && obj.marks.BEE) || "",
    };
  }

  // Set textContent safely inside a document (document may be main doc or svgDoc)
  function applyValuesToDoc(doc, values) {
    if (!doc || !values) return;
    Object.keys(ID_MAP).forEach((k) => {
      const id = ID_MAP[k];
      if (!id) return;
      try {
        const el = doc.getElementById(id);
        if (el) el.textContent = values[k] != null ? String(values[k]) : "";
      } catch (e) {
        // ignore cross-origin or read-only errors
        // console.warn('apply to doc failed for', id, e);
      }
    });
  }

  // Try to apply to inline SVG (document) and to embedded <object>/<embed>
  function applyAll(values) {
    // 1) inline SVG in the current document
    applyValuesToDoc(document, values);

    // 2) embedded object/embed elements (wait for their load if not ready)
    const selectors = [
      'object[data*="exp7_output.svg"]',
      'object[data$=".svg"]',
      'embed[src$=".svg"]',
    ];
    const embedded = document.querySelectorAll(selectors.join(","));
    embedded.forEach((node) => {
      // If node.contentDocument is available -> apply immediately
      const tryApply = () => {
        try {
          const svgDoc = node.contentDocument;
          if (svgDoc) {
            applyValuesToDoc(svgDoc, values);
            return true;
          }
        } catch (e) {
          // cross-origin or not ready
        }
        return false;
      };
      if (!tryApply()) {
        node.addEventListener(
          "load",
          () => {
            tryApply();
          },
          { once: true }
        );
      }
    });
  }

  // Public entry: run on DOMContentLoaded (safe)
  document.addEventListener("DOMContentLoaded", function () {
    const raw = readStudentUser();
    if (!raw) {
      // nothing found — you can optionally log
      console.log("studentUser not in localStorage; nothing applied to SVG.");
      return;
    }
    const values = buildValues(raw);
    applyAll(values);
    // also return values for debugging if needed
    console.log("Applied studentUser -> SVG ids", values);
  });
})();

/**
 * applyTemplateToSvg(targetId, template, [data])
 *
 * - targetId: id of <text> (or any element) inside the SVG (inline SVG) OR inside an embedded SVG (<object>).
 * - template: string with ${...} placeholders, e.g. "Name: ${firstName} ${lastName} — Email: ${email}"
 * - data: optional object to use instead of localStorage.studentUser
 *
 * Replaces placeholders with values and writes result to element.textContent (safe, no HTML injection).
 * Works with inline SVG or object/embed svg (waits for load).
 */
(function () {
  const SVG_EMBED_SELECTOR = 'object[data$=".svg"], embed[src$=".svg"]';

  function safeParseStoredStudent() {
    const raw = localStorage.getItem("studentUser");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      try {
        // try to normalize single-quoted Python-like dicts
        const normalized = raw
          .replace(/(['"])?([A-Za-z0-9 _\-]+)\1\s*:/g, '"$2":')
          .replace(/:\s*'([^']*)'/g, ':"$1"');
        return JSON.parse(normalized);
      } catch (err) {
        return null;
      }
    }
  }

  function getByPath(obj, path) {
    if (!obj) return "";
    const parts = path.split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return "";
      cur = cur[p];
    }
    // return empty string for undefined/null so template remains clean
    return cur === undefined || cur === null ? "" : cur;
  }

// Transform helpers
const TRANSFORMS = {
  upper: v => String(v).toUpperCase(),
  lower: v => String(v).toLowerCase(),
  len: v => String(v).length,
  reverse: v => String(v).split("").reverse().join(""),

  // NEW ADDITION TRANSFORM
  add: (a, b) => Number(a) + Number(b) + 1,
};

// Get value from nested object path (e.g. Marks.AC)
function getByPath(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return "";
    cur = cur[p];
  }
  return cur == null ? "" : cur;
}

// Render template supporting pipes: ${path | transform1 | transform2}
function renderTemplate(template, dataObj) {
  return template.replace(/\$\{([^}]+)\}/g, (full, expr) => {

    // Support: add(expr1, expr2)
    if (expr.startsWith("add(")) {
      const inner = expr.slice(4, -1); // remove add(...)
      const [left, right] = inner.split(",").map(s => s.trim());

      const leftVal  = renderTemplate("${" + left  + "}", dataObj);
      const rightVal = renderTemplate("${" + right + "}", dataObj);

      return TRANSFORMS.add(leftVal, rightVal);
    }

    // Handle pipes: x | transform1 | transform2
    const parts = expr.split("|").map(s => s.trim());
    let value = getByPath(dataObj, parts[0]);

    for (let i = 1; i < parts.length; i++) {
      const t = parts[i];
      if (TRANSFORMS[t]) value = TRANSFORMS[t](value);
    }

    return String(value);
  });
}



  // Set textContent into a document (main doc or svgDoc)
  function setTextInDoc(doc, targetId, text) {
    if (!doc) return false;
    try {
      const el = doc.getElementById(targetId);
      if (!el) return false;
      el.textContent = text;
      return true;
    } catch (e) {
      return false;
    }
  }

  // Public function
  window.applyTemplateToSvg = function (targetId, template, data) {
    const dataObj = data || safeParseStoredStudent() || {};
    const rendered = renderTemplate(template, dataObj);

    // Try inline document first
    if (setTextInDoc(document, targetId, rendered)) return true;

    // Try embedded objects/embeds (may require waiting for load)
    const embeds = document.querySelectorAll(SVG_EMBED_SELECTOR);
    if (embeds.length === 0) {
      console.warn(
        "applyTemplateToSvg: target not found inline and no svg embed present:",
        targetId
      );
      return false;
    }

    let applied = false;
    embeds.forEach((node) => {
      try {
        const tryNow = () => {
          try {
            const svgDoc = node.contentDocument;
            if (svgDoc && setTextInDoc(svgDoc, targetId, rendered)) {
              applied = true;
              return true;
            }
          } catch (e) {
            // access/CORS or not ready
          }
          return false;
        };
        if (!tryNow()) {
          node.addEventListener("load", () => tryNow(), { once: true });
        }
      } catch (e) {
        /* ignore */
      }
    });

    return applied;
  };
})();



// Text wraping in the width
/**
 * Wrap SVG text into multiple <tspan> rows so each row <= maxWidth (px).
 * Adds EXTRA SPACE **between lines** using lineGapPx.
 *
 * @param {Document|SVGElement} svgDocOrEl
 * @param {string} textId
 * @param {number} maxWidthPx
 * @param {number} lineGapPx = 4   -> Extra space BETWEEN wrapped lines
 */
function wrapSvgText(svgDocOrEl, textId, maxWidthPx, lineGapPx = 4) {
  const SVG_NS = "http://www.w3.org/2000/svg";

  let el = svgDocOrEl.getElementById && svgDocOrEl.getElementById(textId);
  if (!el) return false;

  // Find the <text> parent
  let textEl = el;
  if (textEl.tagName.toLowerCase() !== "text") {
    while (textEl && textEl.tagName && textEl.tagName.toLowerCase() !== "text")
      textEl = textEl.parentNode;
    if (!textEl) return false;
  }

  const sourceText = (el.textContent || "").trim();
  if (!sourceText) return false;

  // Get original x/y
  const origX = textEl.getAttribute("x") || 0;
  const origY = textEl.getAttribute("y") || 0;

  const computed = (svgDocOrEl.defaultView || window).getComputedStyle(textEl);
  const fontSizePx = parseFloat(computed.fontSize) || 16;

  // DEFAULT line height + your custom gap
  const lineHeight = fontSizePx * 1.12 + lineGapPx;

  // Clear previous tspans
  while (textEl.firstChild) textEl.removeChild(textEl.firstChild);

  function createTspan(text, isFirstLine) {
    const tspan = document.createElementNS(SVG_NS, "tspan");
    tspan.setAttribute("x", origX);

    if (isFirstLine) {
      tspan.setAttribute("y", origY);
    } else {
      tspan.setAttribute("dy", lineHeight);
    }

    tspan.textContent = text;
    return tspan;
  }

  const words = sourceText.split(/\s+/);
  let line = "";
  let isFirst = true;

  // Temporary tspan for measuring width
  let measure = createTspan("", true);
  textEl.appendChild(measure);

  for (let w of words) {
    const testLine = line ? line + " " + w : w;
    measure.textContent = testLine;

    if (measure.getComputedTextLength() <= maxWidthPx) {
      line = testLine;
    } else {
      // Commit previous line
      const t = createTspan(line, isFirst);
      textEl.appendChild(t);
      isFirst = false;

      // Start new line
      line = w;
      measure.textContent = w;
    }
  }

  // Last line
  const t = createTspan(line, isFirst);
  textEl.appendChild(t);

  // Remove the measuring tspan
  textEl.removeChild(measure);

  return true;
}
