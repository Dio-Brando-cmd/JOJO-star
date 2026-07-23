// Simple markdown to LaTeX converter
const fs = require('fs');
const md = fs.readFileSync(process.argv[2], 'utf-8');
const outFile = process.argv[3];

function esc(s) {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[&]/g, '\\&')
    .replace(/[%]/g, '\\%')
    .replace(/[$]/g, '\\$')
    .replace(/[#]/g, '\\#')
    .replace(/[_]/g, '\\_')
    .replace(/[{]/g, '\\{')
    .replace(/[}]/g, '\\}')
    .replace(/[~]/g, '\\textasciitilde{}')
    .replace(/[\^]/g, '\\textasciicircum{}');
}

let out = '';
out += '\\documentclass[12pt,a4paper,openany]{ctexbook}\n';
out += '\\usepackage{geometry}\n\\geometry{margin=1in}\n';
out += '\\usepackage{hyperref}\n';
out += '\\usepackage{setspace}\n\\onehalfspacing\n';
out += '\\usepackage{fancyhdr}\n\\pagestyle{fancy}\n';
out += '\\fancyhf{}\n\\fancyhead[LE,RO]{\\thepage}\n';
out += '\\fancyhead[RE]{\\leftmark}\n\\fancyhead[LO]{\\rightmark}\n';
out += '\\renewcommand{\\headrulewidth}{0.4pt}\n';
out += '\\usepackage{indentfirst}\n\\setlength{\\parindent}{2em}\n';
out += '\\begin{document}\n\n';
out += '\\title{帷幕之地 \\cdot 灵焰纪元}\n';
out += '\\author{帷幕之地世界组}\n\\date{\\today}\n\\maketitle\n';
out += '\\tableofcontents\n\\newpage\n\n';

const lines = md.split('\n');
let inCode = false;
let inQuote = false;
let quoteLines = [];
let inTable = false;
let tableHeader = true;

for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  const line = raw.trim();

  // Skip the title line (it's already on cover)
  if (i === 0 && line.startsWith('# ')) continue;
  // Skip metadata lines at start
  if (i < 4 && (line.startsWith('>') || line === '')) continue;

  // Code blocks
  if (line.startsWith('```')) {
    if (inCode) { out += '\\end{verbatim}\n\n'; inCode = false; }
    else { out += '\\begin{verbatim}\n'; inCode = true; }
    continue;
  }
  if (inCode) { out += raw + '\n'; continue; }

  // Horizontal rule
  if (line === '---') { out += '\\bigskip\\hrule\\bigskip\n\n'; continue; }

  // Tables
  if (line.startsWith('|') && line.endsWith('|')) {
    if (line.match(/^\|[\s\-:]+\|$/)) { tableHeader = false; continue; }
    if (!inTable) { out += '\\begin{tabular}{|' + 'l|'.repeat(line.split('|').length - 2) + '}\n\\hline\n'; inTable = true; tableHeader = true; }
    const cells = line.split('|').filter(c => c !== '').map(c => esc(c.trim()));
    out += cells.join(' & ') + ' \\\\\n';
    if (tableHeader) { out += '\\hline\n'; tableHeader = false; }
    continue;
  } else if (inTable) {
    out += '\\hline\n\\end{tabular}\n\n';
    inTable = false;
  }

  // Blockquotes
  if (line.startsWith('> ')) {
    if (!inQuote) { inQuote = true; quoteLines = []; }
    quoteLines.push(line.replace(/^> /, ''));
    continue;
  } else if (inQuote) {
    inQuote = false;
    out += '\\begin{quote}\n';
    for (const ql of quoteLines) {
      // Handle bold/italic in quotes
      let qe = esc(ql);
      qe = qe.replace(/\\textbackslash\{\}textbackslash\{\}textbf\{([^}]+)\}/g, '\\textbf{$1}');
      qe = qe.replace(/\\*\\*([^*]+)\\*\\*/g, '\\textbf{$1}');
      out += qe + '\n\n';
    }
    out += '\\end{quote}\n\n';
    quoteLines = [];
  }

  // Headings
  if (line.startsWith('### ')) { out += '\\subsection*{' + esc(line.replace(/^### /, '')) + '}\n\n'; continue; }
  if (line.startsWith('## ')) { out += '\\section*{' + esc(line.replace(/^## /, '')) + '}\n\n'; continue; }
  if (line.startsWith('# ')) { out += '\\chapter{' + esc(line.replace(/^# /, '')) + '}\n\n'; continue; }

  // Regular paragraph
  if (line === '') { out += '\n'; continue; }

  let processed = esc(line);
  // Bold: **text**
  processed = processed.replace(/\\*\\*([^*]+)\\*\\*/g, '\\textbf{$1}');
  out += processed + '\n\n';
}

// Close any open environments
if (inQuote) {
  out += '\\begin{quote}\n';
  out += quoteLines.map(l => esc(l)).join('\n\n') + '\n';
  out += '\\end{quote}\n\n';
}
if (inTable) { out += '\\hline\n\\end{tabular}\n\n'; }

out += '\\end{document}\n';
fs.writeFileSync(outFile, out, 'utf-8');
console.log('Done:', out.length, 'chars ->', outFile);
