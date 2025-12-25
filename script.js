const canvas = document.getElementById('treeCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const seqEl = document.getElementById('sequenceContainer');
const fileInput = document.getElementById('fileInput');
const autoPlayCheck = document.getElementById('autoPlay');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const restartBtn = document.getElementById('restartBtn');
const speedInput = document.getElementById('speed');

let root = null;
let historyStack = []; 
let currentStep = -1;
let animationTimer = null;

class Node {
    constructor(val) {
        this.val = val;
        this.left = null; this.right = null;
        this.x = 0; this.y = 0;
        this.isCurrent = false;   
        this.isSearching = false; 
        this.visited = false;     
    }
}

function cloneTree(node) {
    if (!node) return null;
    let newNode = new Node(node.val);
    newNode.x = node.x; newNode.y = node.y;
    newNode.isCurrent = node.isCurrent;
    newNode.isSearching = node.isSearching;
    newNode.visited = node.visited;
    newNode.left = cloneTree(node.left);
    newNode.right = cloneTree(node.right);
    return newNode;
}

function recordStep(tree, msg, sequence) {
    updateNodePositions(tree);
    historyStack.push({
        tree: cloneTree(tree),
        status: msg,
        sequence: [...sequence]
    });
}

function renderCurrentStep() {
    if (currentStep < 0 || currentStep >= historyStack.length) return;
    const snapshot = historyStack[currentStep];
    root = snapshot.tree;
    statusEl.innerText = snapshot.status;
    seqEl.innerText = "遍歷序列: " + (snapshot.sequence.join(" → ") || "無");
    draw();
    
    prevBtn.disabled = currentStep <= 0;
    nextBtn.disabled = currentStep >= historyStack.length - 1;
    restartBtn.disabled = historyStack.length === 0;
}

function playNext() {
    if (currentStep < historyStack.length - 1) {
        currentStep++;
        renderCurrentStep();
        animationTimer = setTimeout(playNext, 1100 - speedInput.value);
    }
}

function stopAnimation() {
    if (animationTimer) clearTimeout(animationTimer);
}

function initAnimation() {
    historyStack = [];
    currentStep = 0;
}

// --- 動作處理 (加入狀態重置) ---
async function handleAction(type) {
    stopAnimation();
    resetState(root); // 解決 Bug：清除遍歷留下的顏色
    initAnimation();
    
    const val = parseInt(document.getElementById('nodeValue').value);
    if (isNaN(val)) return;

    if (type === 'insert') {
        if (!root) {
            root = new Node(val);
            recordStep(root, `建立根節點 ${val}`, []);
        } else {
            insertLogic(root, val);
        }
    } else {
        root = deleteLogic(root, val);
    }
    
    recordStep(root, "操作完成", []);
    startPlayback();
}

function insertLogic(node, v) {
    node.isSearching = true;
    recordStep(root, `比較 ${v} 與 ${node.val}`, []);
    
    if (v < node.val) {
        node.isSearching = false;
        if (!node.left) {
            node.left = new Node(v);
            recordStep(root, `在左側插入 ${v}`, []);
        } else {
            insertLogic(node.left, v);
        }
    } else if (v > node.val) {
        node.isSearching = false;
        if (!node.right) {
            node.right = new Node(v);
            recordStep(root, `在右側插入 ${v}`, []);
        } else {
            insertLogic(node.right, v);
        }
    }
    node.isSearching = false;
}

function deleteLogic(n, v) {
    if (!n) { recordStep(root, `找不到 ${v}`, []); return null; }
    n.isSearching = true;
    recordStep(root, `搜尋 ${v}，目前在 ${n.val}`, []);
    if (v < n.val) {
        n.isSearching = false;
        n.left = deleteLogic(n.left, v);
    } else if (v > n.val) {
        n.isSearching = false;
        n.right = deleteLogic(n.right, v);
    } else {
        n.isSearching = false;
        n.isCurrent = true;
        recordStep(root, `找到目標 ${v}`, []);
        if (!n.left || !n.right) {
            const next = n.left || n.right;
            n.isCurrent = false;
            return next;
        }
        let succ = n.right;
        while (succ.left) {
            succ.isSearching = true;
            recordStep(root, `尋找後繼者...`, []);
            succ.isSearching = false;
            succ = succ.left;
        }
        n.val = succ.val;
        recordStep(root, `用 ${succ.val} 取代目標`, []);
        n.isCurrent = false;
        n.right = deleteLogic(n.right, succ.val);
    }
    if (n) n.isSearching = false;
    return n;
}

function startTraversal(type) {
    stopAnimation();
    resetState(root); // 開始遍歷前也清空一次
    initAnimation();
    if (!root) return;
    
    let queue = [];
    if (type === 'preorder') getPre(root, queue);
    else if (type === 'inorder') getIn(root, queue);
    else getPost(root, queue);

    let seq = [];
    for (let node of queue) {
        node.isCurrent = true;
        recordStep(root, `${type}: 訪問 ${node.val}`, seq);
        node.isCurrent = false;
        node.visited = true;
        seq.push(node.val);
        recordStep(root, `${node.val} 已紀錄`, seq);
    }
    startPlayback();
}

function startPlayback() {
    renderCurrentStep();
    if (autoPlayCheck.checked) playNext();
}

// --- 繪圖基礎 ---
function updateNodePositions(node) {
    if (!node) return;
    function assign(n, lvl, l, r) {
        if (!n) return;
        n.x = (l + r) / 2;
        n.y = lvl * 70 + 60;
        assign(n.left, lvl + 1, l, n.x);
        assign(n.right, lvl + 1, n.x, r);
    }
    assign(node, 1, 0, canvas.width);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!root) return;
    drawEdges(root);
    drawNodes(root);
}

function drawEdges(n) {
    ctx.strokeStyle = "#bdc3c7";
    if (n.left) { ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(n.left.x, n.left.y); ctx.stroke(); drawEdges(n.left); }
    if (n.right) { ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(n.right.x, n.right.y); ctx.stroke(); drawEdges(n.right); }
}

function drawNodes(n) {
    if (!n) return;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 22, 0, Math.PI * 2);
    ctx.fillStyle = n.isCurrent ? "#e74c3c" : n.isSearching ? "#f1c40f" : n.visited ? "#2ecc71" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#34495e"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = (n.isCurrent || n.isSearching || n.visited) ? "#fff" : "#333";
    ctx.textAlign = "center"; ctx.font = "bold 14px Arial";
    ctx.fillText(n.val, n.x, n.y + 5);
    drawNodes(n.left); drawNodes(n.right);
}

// --- 輔助函式 ---
function resetState(n) { 
    if(n){ 
        n.isCurrent = false; 
        n.isSearching = false; 
        n.visited = false; 
        resetState(n.left); 
        resetState(n.right); 
    } 
}
function getPre(n, q) { if(n){ q.push(n); getPre(n.left,q); getPre(n.right,q); } }
function getIn(n, q) { if(n){ getIn(n.left,q); q.push(n); getIn(n.right,q); } }
function getPost(n, q) { if(n){ getPost(n.left,q); getPost(n.right,q); q.push(n); } }

nextBtn.onclick = () => { stopAnimation(); if (currentStep < historyStack.length - 1) { currentStep++; renderCurrentStep(); } };
prevBtn.onclick = () => { stopAnimation(); if (currentStep > 0) { currentStep--; renderCurrentStep(); } };
function restartAnimation() { stopAnimation(); currentStep = 0; renderCurrentStep(); if (autoPlayCheck.checked) playNext(); }

fileInput.onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const nums = ev.target.result.trim().split(/\s+/).map(Number);
        const sorted = [...new Set(nums.filter(n=>!isNaN(n)))].sort((a,b)=>a-b);
        root = buildBal(sorted, 0, sorted.length-1);
        stopAnimation();
        initAnimation();
        updateNodePositions(root);
        draw();
    };
    reader.readAsText(e.target.files[0]);
};

function buildBal(a, s, e) {
    if(s>e) return null;
    let m = Math.floor((s+e)/2);
    let n = new Node(a[m]);
    n.left = buildBal(a, s, m-1); n.right = buildBal(a, m+1, e);
    return n;
}

window.onresize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - canvas.offsetTop;
    updateNodePositions(root);
    draw();
};
window.onresize();