<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>GOLF PUTT NAVI - V28 AUTO SYNC</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background: #121212; color: #fff; display: flex; flex-direction: column; align-items: center; height: 100vh; overflow: hidden; }
        .header { width: 100%; padding: 12px 0; text-align: center; background: #1e5631; font-size: 1rem; font-weight: bold; z-index: 10; }
        .status-bar { padding: 6px; font-size: 0.85rem; color: #aaa; text-align: center; z-index: 10; min-height: 20px; background: #000; width: 100%; }
        #canvas-container { width: 100vw; flex-grow: 1; position: relative; overflow: hidden; background: #1a1a1a; touch-action: none; }
        svg { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
        image { pointer-events: none; user-select: none; }
        .highlight-cell { fill: rgba(255, 235, 59, 0.25); stroke: #ffeb3b; stroke-width: 0.3; }
        .controls { width: 100%; max-width: 400px; padding: 15px; box-sizing: border-box; background: rgba(30, 30, 30, 0.95); border-radius: 12px 12px 0 0; z-index: 10; box-shadow: 0 -4px 10px rgba(0,0,0,0.5); }
        .info-display { font-size: 0.85rem; color: #a1c181; text-align: center; margin-bottom: 4px; font-weight: bold; }
        .result-text { font-size: 1.2rem; font-weight: bold; color: #ffeb3b; text-align: center; margin: 8px 0; min-height: 28px; white-space: pre-line; line-height: 1.4; }
        .btn-group { display: flex; gap: 10px; margin-top: 5px; }
        .btn { flex: 1; padding: 12px; border: none; border-radius: 6px; font-size: 0.95rem; font-weight: bold; cursor: pointer; }
        .btn-reset { background: #444; color: white; }
        .btn-back { background: #c62828; color: white; }
    </style>
</head>
<body>

<div class="header" id="mainHeader">GOLF PUTT NAVI</div>
<div class="status-bar" id="statusBar">【ボール位置】をタップしてください</div>

<div class="page active" id="page-home">
    <div class="home-container">
        <div class="section-title">ホールを選択</div>
        <div class="grid-channels" id="hole-grid"></div>
    </div>
</div>

<div class="page" id="page-game">
    <div id="canvas-container">
        <svg id="greenSvg" viewBox="0 0 1000 1000">
            <image id="mapImage" width="1000" height="1000" x="0" y="0" preserveAspectRatio="xMidYMid meet" />
            <g id="highlightGroup"></g>
            <line id="traceLine" stroke="#fff" stroke-width="6" stroke-dasharray="8,8" style="display:none;"/>
            <circle id="ballMarker" r="14" fill="#2196f3" stroke="white" stroke-width="3" style="display:none;"/>
            <circle id="pinMarker" r="14" fill="#f44336" stroke="white" stroke-width="3" style="display:none;"/>
        </svg>
    </div>

    <div class="controls">
        <div class="info-display" id="distanceOut"></div>
        <div class="info-display" id="heightOut" style="color: #ffb74d;"></div>
        <div class="result-text" id="uiResult">ボール位置を選択してください</div>
        
        <div class="btn-group">
            <button class="btn btn-back" onclick="goBackHome()">← 戻る</button>
            <button class="btn btn-reset" onclick="resetApp()">リセット</button>
        </div>
    </div>
</div>

<script type="module">
    import { HOLE_DATABASES } from './data.js';
    window.HOLE_DATABASES = HOLE_DATABASES;

    // 【全自動キャリブレーション・データベース】
    // 1000x1000空間における、各ホールの実際の写真の網目（グリッド0〜40）の写り込み範囲
    // 6番・9番・12番ホールのバラバラな余白サイズを完全に解析して固定値化しました
    const HOLE_GRID_CONFIG = {
        1:  { left: 50,  top: 100, right: 950, bottom: 900 },
        2:  { left: 50,  top: 100, right: 950, bottom: 900 },
        3:  { left: 50,  top: 100, right: 950, bottom: 900 },
        4:  { left: 50,  top: 100, right: 950, bottom: 900 },
        5:  { left: 50,  top: 100, right: 950, bottom: 900 },
        6:  { left: 52,  top: 270, right: 948, bottom: 588 }, // 6番写真の余白に完全最適化
        7:  { left: 50,  top: 100, right: 950, bottom: 900 },
        8:  { left: 50,  top: 100, right: 950, bottom: 900 },
        9:  { left: 60,  top: 254, right: 940, bottom: 618 }, // 9番写真の余白に完全最適化
        10: { left: 50,  top: 100, right: 950, bottom: 900 },
        11: { left: 50,  top: 100, right: 950, bottom: 900 },
        12: { left: 52,  top: 245, right: 948, bottom: 622 }, // 12番写真の余白に完全最適化
        13: { left: 50,  top: 100, right: 950, bottom: 900 },
        15: { left: 50,  top: 100, right: 950, bottom: 900 },
        16: { left: 50,  top: 100, right: 950, bottom: 900 },
        17: { left: 50,  top: 100, right: 950, bottom: 900 },
        18: { left: 50,  top: 100, right: 950, bottom: 900 },
    };

    const greenSlopeMap = {};

    function buildMapForHole(num) {
        const data = HOLE_DATABASES[num] || {};
        for(let x=0; x<=40; x++) {
            for(let y=0; y<=40; y++) {
                const key = `${x},${y}`;
                if(data[key]) {
                    greenSlopeMap[key] = data[key];
                } else {
                    let totalWeight = 0, ws = 0, wx = 0, wy = 0;
                    for (const [k, d] of Object.entries(data)) {
                        const [kx, ky] = k.split(',').map(Number);
                        const dist = Math.hypot(x-kx, y-ky) || 0.1;
                        const w = 1 / Math.pow(dist, 2);
                        ws += d.slope * w;
                        wx += Math.sin(d.angle * Math.PI / 180) * w;
                        wy += Math.cos(d.angle * Math.PI / 180) * w;
                        totalWeight += w;
                    }
                    if (totalWeight > 0) {
                        const rad = Math.atan2(wx/totalWeight, wy/totalWeight);
                        let deg = rad * 180 / Math.PI;
                        if (deg < 0) deg += 360;
                        greenSlopeMap[key] = { slope: ws/totalWeight, angle: deg };
                    } else {
                        greenSlopeMap[key] = { slope: 1.5, angle: 180 };
                    }
                }
            }
        }
    }

    let currentHole = null, ballPos = null, pinPos = null;

    const grid = document.getElementById('hole-grid');
    for(let i=1; i<=18; i++) {
        const div = document.createElement('div');
        div.className = i===14 ? 'hole-btn disabled' : 'hole-btn';
        div.innerText = i+'H';
        div.onclick = () => { if(i!==14) selectHole(i); };
        grid.appendChild(div);
    }

    window.selectHole = (num) => {
        currentHole = num;
        document.getElementById('mapImage').setAttribute('href', `${num}.jpg`);
        buildMapForHole(num);
        document.getElementById('page-home').classList.remove('active');
        document.getElementById('page-game').classList.add('active');
        resetApp();
    };

    window.goBackHome = () => {
        document.getElementById('page-game').classList.remove('active');
        document.getElementById('page-home').classList.add('active');
        currentHole = null;
    };

    document.getElementById('greenSvg').addEventListener('click', (e) => {
        if (!currentHole) return;
        const svg = document.getElementById('greenSvg');
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
        
        if (!ballPos) {
            ballPos = pt;
            setMarker('ballMarker', pt.x, pt.y);
            document.getElementById('statusBar').innerText = "次に【ピン位置】をタップしてください";
            document.getElementById('uiResult').innerText = "ピン位置を選択してください";
            return;
        }
        
        if (!pinPos) {
            pinPos = pt;
            setMarker('pinMarker', pt.x, pt.y);
            document.getElementById('statusBar').innerText = "計算完了";
            runSim();
        }
    });

    function setMarker(id, x, y) {
        const el = document.getElementById(id);
        el.setAttribute('cx', x); el.setAttribute('cy', y); el.style.display = 'block';
    }

    function runSim() {
        const cfg = HOLE_GRID_CONFIG[currentHole] || { left: 50, top: 100, right: 950, bottom: 900 };

        const gridWidthPx = cfg.right - cfg.left;
        const gridHeightPx = cfg.bottom - cfg.top;

        // タップピクセル座標を「0〜40ヤードのマス目」へパーフェクトアジャスト
        const ballGridX = ((ballPos.x - cfg.left) / gridWidthPx) * 40;
        const ballGridY = 40 - ((ballPos.y - cfg.top) / gridHeightPx) * 40;
        const pinGridX = ((pinPos.x - cfg.left) / gridWidthPx) * 40;
        const pinGridY = 40 - ((pinPos.y - cfg.top) / gridHeightPx) * 40;

        const dGridX = pinGridX - ballGridX;
        const dGridY = pinGridY - ballGridY;
        const distanceYards = Math.hypot(dGridX, dGridY);
        const distanceMeters = distanceYards * 0.9144;
        
        document.getElementById('distanceOut').innerText = `📏 距離: ${distanceYards.toFixed(1)} ヤード (約 ${distanceMeters.toFixed(1)} m)`;

        let totalHeightCm = 0;
        let totalSideDeviationCm = 0;
        
        const steps = Math.floor(distanceYards / 0.1);
        const highlightGroup = document.getElementById('highlightGroup');
        highlightGroup.innerHTML = '';
        let checkedCells = new Set();

        for(let i = 0; i <= steps; i++) {
            const t = steps === 0 ? 0 : i / steps;
            const curGridX = ballGridX + dGridX * t;
            const curGridY = ballGridY + dGridY * t;

            const gx = Math.max(0, Math.min(40, Math.floor(curGridX)));
            const gy = Math.max(0, Math.min(40, Math.floor(curGridY)));
            const cellKey = `${gx},${gy}`;
            
            const cell = greenSlopeMap[cellKey] || {slope: 0, angle: 180};
            
            if (!checkedCells.has(cellKey)) {
                checkedCells.add(cellKey);
                const screenX = cfg.left + (gx / 40) * gridWidthPx;
                const screenY = cfg.top + ((40 - gy - 1) / 40) * gridHeightPx;
                highlightGroup.innerHTML += `<rect class="highlight-cell" x="${screenX}" y="${screenY}" width="${gridWidthPx/40}" height="${gridHeightPx/40}" />`;
            }

            const padAngle = Math.atan2(dGridY, dGridX);
            const slopeRad = cell.angle * Math.PI / 180;
            const slopeX = Math.sin(slopeRad);
            const slopeY = -Math.cos(slopeRad);

            const stepYards = 0.1;
            const heightCmPerDegreePerStep = 1.6 * stepYards;

            const cosForward = slopeX * Math.cos(padAngle) + slopeY * Math.sin(padAngle);
            const stepHeightCm = -cosForward * cell.slope * heightCmPerDegreePerStep;
            totalHeightCm += stepHeightCm; 

            const sinSide = slopeX * (-Math.sin(padAngle)) - slopeY * Math.cos(padAngle);
            const slopeWeight = cosForward > 0 ? (1.0 + cosForward * (cell.slope / 4.0)) : (1.0 / (1.0 + Math.abs(cosForward) * (cell.slope / 6.0)));

            const sideCmPerDegreePerStep = 1.1 * stepYards * slopeWeight;
            totalSideDeviationCm += sinSide * cell.slope * sideCmPerDegreePerStep;
        }

        const heightType = totalHeightCm < 0 ? "下り" : "上り";
        document.getElementById('heightOut').innerText = `📐 高低差: 約 ${Math.abs(totalHeightCm).toFixed(1)} cm の 【${heightType}】`;

        const finalCups = totalSideDeviationCm / 10.8;
        const directionCorrected = finalCups > 0 ? "左" : "右";

        const uiResult = document.getElementById('uiResult');
        if (Math.abs(finalCups) < 0.2) {
            uiResult.innerText = "ほぼストレートに狙う";
        } else {
            uiResult.innerText = `カップの 【${directionCorrected}】 に ${Math.abs(finalCups).toFixed(1)} カップ外す`;
        }

        const line = document.getElementById('traceLine');
        line.setAttribute('x1', ballPos.x); line.setAttribute('y1', ballPos.y);
        line.setAttribute('x2', pinPos.x); line.setAttribute('y2', pinPos.y);
        line.style.display = 'block';
    }

    window.resetApp = () => {
        ballPos = null; pinPos = null;
        document.getElementById('ballMarker').style.display = 'none';
        document.getElementById('pinMarker').style.display = 'none';
        document.getElementById('traceLine').style.display = 'none';
        document.getElementById('highlightGroup').innerHTML = '';
        document.getElementById('distanceOut').innerText = '';
        document.getElementById('heightOut').innerText = '';
        document.getElementById('uiResult').innerText = "ボール位置を選択してください";
        if(currentHole) document.getElementById('statusBar').innerText = "【ボール位置】をタップしてください";
    };
</script>
</body>
</html>
