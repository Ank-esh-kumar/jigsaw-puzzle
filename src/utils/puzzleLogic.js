export const generatePieces = (boardW, boardH, rows, cols) => {
  const pieces = [];
  const pieceWidth = boardW / cols;
  const pieceHeight = boardH / rows;

  const verticalTabs = [];
  const horizontalTabs = [];

  for (let c = 0; c < cols; c++) {
    verticalTabs[c] = [];
    horizontalTabs[c] = [];
    for (let r = 0; r < rows; r++) {
      verticalTabs[c][r] = Math.random() > 0.5 ? 1 : -1;
      horizontalTabs[c][r] = Math.random() > 0.5 ? 1 : -1;
    }
  }

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const tabs = {
        top: i === 0 ? 0 : horizontalTabs[j][i - 1] === 1 ? -1 : 1,
        right: j === cols - 1 ? 0 : verticalTabs[j][i],
        bottom: i === rows - 1 ? 0 : horizontalTabs[j][i],
        left: j === 0 ? 0 : verticalTabs[j - 1][i] === 1 ? -1 : 1
      };

      pieces.push({
        id: `p-${i}-${j}`,
        correctX: j * pieceWidth,
        correctY: i * pieceHeight,
        x: 0, 
        y: 0,
        w: pieceWidth,
        h: pieceHeight,
        tabs: tabs,
        isFixed: false,
        status: 'tray', 
      });
    }
  }

  const randomIndex = Math.floor(Math.random() * pieces.length);
  pieces[randomIndex].status = 'board';
  pieces[randomIndex].isFixed = true;
  pieces[randomIndex].x = pieces[randomIndex].correctX;
  pieces[randomIndex].y = pieces[randomIndex].correctY;
  
  return pieces;
};

export const calculateDistance = (currentX, currentY, targetX, targetY) => {
  return Math.sqrt(Math.pow(currentX - targetX, 2) + Math.pow(currentY - targetY, 2));
};

export const drawPiecePath = (ctx, w, h, tabs) => {
  const knob = Math.min(w, h) * 0.22; 
  ctx.beginPath();
  ctx.moveTo(0, 0);

  if (tabs.top) { ctx.lineTo(w / 2 - knob, 0); ctx.arc(w / 2, 0, knob, Math.PI, 0, tabs.top === -1); }
  ctx.lineTo(w, 0);

  if (tabs.right) { ctx.lineTo(w, h / 2 - knob); ctx.arc(w, h / 2, knob, -Math.PI / 2, Math.PI / 2, tabs.right === -1); }
  ctx.lineTo(w, h);

  if (tabs.bottom) { ctx.lineTo(w / 2 + knob, h); ctx.arc(w / 2, h, knob, 0, Math.PI, tabs.bottom === -1); }
  ctx.lineTo(0, h);

  if (tabs.left) { ctx.lineTo(0, h / 2 + knob); ctx.arc(0, h / 2, knob, Math.PI / 2, -Math.PI / 2, tabs.left === -1); }
  
  ctx.lineTo(0, 0);
  ctx.closePath();
};

export const getSvgPath = (w, h, tabs) => {
  const knob = Math.min(w, h) * 0.22;
  let d = `M 0 0 `;

  if (tabs.top) {
    d += `L ${w/2 - knob} 0 `;
    d += `A ${knob} ${knob} 0 0 ${tabs.top === 1 ? 1 : 0} ${w/2 + knob} 0 `;
  }
  d += `L ${w} 0 `;

  if (tabs.right) {
    d += `L ${w} ${h/2 - knob} `;
    d += `A ${knob} ${knob} 0 0 ${tabs.right === 1 ? 1 : 0} ${w} ${h/2 + knob} `;
  }
  d += `L ${w} ${h} `;

  if (tabs.bottom) {
    d += `L ${w/2 + knob} ${h} `;
    d += `A ${knob} ${knob} 0 0 ${tabs.bottom === 1 ? 1 : 0} ${w/2 - knob} ${h} `;
  }
  d += `L 0 ${h} `;

  if (tabs.left) {
    d += `L 0 ${h/2 + knob} `;
    d += `A ${knob} ${knob} 0 0 ${tabs.left === 1 ? 1 : 0} 0 ${h/2 - knob} `;
  }
  d += `Z`;
  return d;
};