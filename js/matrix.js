// matrix.js — live data matrix display for physics mode

const MAX_ROWS = 8;

let containers = {};

export function initMatrix() {
  containers = {
    t:  document.getElementById('matrix-col-t'),
    x:  document.getElementById('matrix-col-x'),
    y:  document.getElementById('matrix-col-y'),
    ym: document.getElementById('matrix-col-ym'),
    vy: document.getElementById('matrix-col-vy'),
  };

  // Create row containers
  for (const key in containers) {
    const rowsDiv = document.createElement('div');
    rowsDiv.className = 'matrix-rows';
    rowsDiv.id = `mrows-${key}`;
    containers[key].appendChild(rowsDiv);
  }
}

export function pushMatrixRow(data, highlight = false) {
  const keys = ['t', 'x', 'y', 'ym', 'vy'];
  const vals = [
    data.t.toFixed(3),
    data.x.toFixed(3),
    data.y.toFixed(3),
    data.ym.toFixed(3),
    data.vy.toFixed(3)
  ];

  keys.forEach((key, i) => {
    const rowsDiv = document.getElementById(`mrows-${key}`);
    if (!rowsDiv) return;

    // Create new row
    const row = document.createElement('div');
    row.className = 'matrix-row-val' + (highlight ? ' highlight' : '');
    row.textContent = vals[i];
    rowsDiv.prepend(row);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        row.classList.add('visible');
      });
    });

    // Trim old rows
    const rows = rowsDiv.querySelectorAll('.matrix-row-val');
    if (rows.length > MAX_ROWS) {
      for (let j = MAX_ROWS; j < rows.length; j++) {
        rows[j].remove();
      }
    }
  });
}

export function clearMatrix() {
  ['t', 'x', 'y', 'ym', 'vy'].forEach(key => {
    const rowsDiv = document.getElementById(`mrows-${key}`);
    if (rowsDiv) rowsDiv.innerHTML = '';
  });
}

export function updateLiveFormulas(proj, theta, v0) {
  const fX = document.getElementById('f-x-live');
  const fY = document.getElementById('f-y-live');
  if (fX) fX.textContent = `${proj.x.toFixed(3)} m`;
  if (fY) fY.textContent = `${proj.y.toFixed(3)} m`;

  // Update theta display
  const fTheta = document.getElementById('f-theta');
  if (fTheta) {
    fTheta.textContent = `${(theta * 180 / Math.PI).toFixed(2)}°`;
  }
}
