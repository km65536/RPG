/**
 * Procedural Pixel RPG - Main Game Script
 */

const TILE_SIZE = 32;

const ITEM_DATABASE = {
    herb: { id: "herb", name: "薬草", cost: 10, sellValue: 5, description: "HPを30回復する" },
    sword: { id: "sword", name: "銅の剣", cost: 50, sellValue: 20, description: "攻撃力が少し上がる" },
    shield: { id: "shield", name: "木の盾", cost: 40, sellValue: 15, description: "耐久力が少し上がる" },
    potion: { id: "potion", name: "魔導ポーション", cost: 100, sellValue: 40, description: "HPを完全回復する" },
    ether: { id: "ether", name: "エーテル", cost: 30, sellValue: 15, description: "MPを20回復する" }
};

const SKILL_DATABASE = {
    power_slash: { id: "power_slash", name: "パワースラッシュ", mpCost: 5, power: 1.5, type: "attack", description: "威力の高い物理攻撃" },
    heal: { id: "heal", name: "ヒール", mpCost: 8, power: 50, type: "heal", description: "HPを回復する魔法" },
    fireball: { id: "fireball", name: "ファイアボール", mpCost: 12, power: 2.0, type: "attack", description: "炎の魔法攻撃" }
};

const QUEST_DATABASE = {
    intro: {
        id: "intro",
        title: "はじめてのお買い物",
        description: "町のNPC「おばあさん」に話しかけ、薬草を1個入手しよう。",
        state: "unlocked"
    },
    extermination: {
        id: "extermination",
        title: "水辺の害虫駆除",
        description: "スライムを3匹倒して、生態を調査しよう。",
        targetCount: 3,
        currentCount: 0,
        state: "unlocked"
    }
};

let GameState = {
    player: {
        x: 5 * TILE_SIZE,
        y: 5 * TILE_SIZE,
        targetX: 5 * TILE_SIZE,
        targetY: 5 * TILE_SIZE,
        level: 1,
        exp: 0,
        sp: 0,
        maxHp: 100,
        hp: 100,
        maxMp: 30,
        mp: 30,
        gold: 100,
        str: 10,
        agi: 10,
        vit: 10,
        inventory: ["herb", "ether"],
        skills: ["power_slash", "heal"]
    },
    quests: JSON.parse(JSON.stringify(QUEST_DATABASE)),
    currentMap: "outside",
    spawnedEnemies: [],
    npcFavorability: {
        "granny": 0,
        "merchant": 0
    },
    settings: {
        keys: {
            up: "KeyW",
            left: "KeyA",
            down: "KeyS",
            right: "KeyD",
            action: "KeyE"
        },
        showTouch: false
    },
    isBattling: false
};

const TextureEngine = {
    canvasCache: {},

    create(name, width, height, drawCallback) {
        if (this.canvasCache[name]) return this.canvasCache[name];
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        drawCallback(ctx);
        this.canvasCache[name] = canvas;
        return canvas;
    },

    init() {
        this.create("grass", 16, 16, (ctx) => {
            ctx.fillStyle = "#4a9c3d";
            ctx.fillRect(0, 0, 16, 16);
            ctx.fillStyle = "#3e8c31";
            ctx.fillRect(2, 4, 2, 2);
            ctx.fillRect(10, 2, 2, 2);
            ctx.fillRect(6, 11, 2, 2);
        });

        this.create("water", 16, 16, (ctx) => {
            ctx.fillStyle = "#3b7ecb";
            ctx.fillRect(0, 0, 16, 16);
            ctx.fillStyle = "#2a6dbb";
            ctx.fillRect(1, 1, 14, 1);
            ctx.fillRect(4, 8, 8, 1);
        });

        this.create("floor", 16, 16, (ctx) => {
            ctx.fillStyle = "#8a5229";
            ctx.fillRect(0, 0, 16, 16);
            ctx.fillStyle = "#6e3f1d";
            ctx.fillRect(0, 15, 16, 1);
            ctx.fillRect(15, 0, 1, 16);
        });

        this.create("wall", 16, 16, (ctx) => {
            ctx.fillStyle = "#555555";
            ctx.fillRect(0, 0, 16, 16);
            ctx.fillStyle = "#333333";
            ctx.fillRect(0, 0, 16, 2);
            ctx.fillRect(0, 0, 2, 16);
            ctx.fillStyle = "#777777";
            ctx.fillRect(2, 2, 12, 12);
        });

        this.create("door", 16, 16, (ctx) => {
            ctx.fillStyle = "#bf431b";
            ctx.fillRect(0, 0, 16, 16);
            ctx.fillStyle = "#7c2b11";
            ctx.fillRect(2, 2, 12, 12);
            ctx.fillStyle = "#ffd700"; 
            ctx.fillRect(12, 8, 2, 2);
        });

        this.create("player_up", 16, 16, (ctx) => this.drawCharacter(ctx, "#4682b4", "up"));
        this.create("player_down", 16, 16, (ctx) => this.drawCharacter(ctx, "#4682b4", "down"));
        this.create("player_left", 16, 16, (ctx) => this.drawCharacter(ctx, "#4682b4", "left"));
        this.create("player_right", 16, 16, (ctx) => this.drawCharacter(ctx, "#4682b4", "right"));

        this.create("npc_granny", 16, 16, (ctx) => this.drawCharacter(ctx, "#ba55d3", "down"));
        this.create("npc_merchant", 16, 16, (ctx) => this.drawCharacter(ctx, "#d2691e", "down"));

        this.create("enemy_slime", 16, 16, (ctx) => {
            ctx.fillStyle = "rgba(0, 0, 0, 0)";
            ctx.clearRect(0, 0, 16, 16);
            ctx.fillStyle = "#00ffff";
            ctx.beginPath();
            ctx.arc(8, 9, 6, 0, Math.PI, true);
            ctx.lineTo(2, 12);
            ctx.lineTo(14, 12);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#000000";
            ctx.fillRect(5, 7, 2, 2);
            ctx.fillRect(9, 7, 2, 2);
        });
    },

    drawCharacter(ctx, bodyColor, dir) {
        ctx.fillStyle = "rgba(0, 0, 0, 0)";
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = bodyColor;
        ctx.fillRect(3, 6, 10, 10);
        ctx.fillStyle = "#ffdbac";
        ctx.fillRect(4, 1, 8, 6);
        ctx.fillStyle = "#333333";
        ctx.fillRect(4, 1, 8, 2);
        ctx.fillStyle = "#000000";
        if (dir === "down") {
            ctx.fillRect(5, 4, 1, 1);
            ctx.fillRect(10, 4, 1, 1);
        } else if (dir === "left") {
            ctx.fillRect(4, 4, 1, 1);
            ctx.fillRect(7, 4, 1, 1);
        } else if (dir === "right") {
            ctx.fillRect(8, 4, 1, 1);
            ctx.fillRect(11, 4, 1, 1);
        }
    }
};

const MapManager = {
    mapsData: {},

    async init() {
        try {
            await this.loadMap("outside", "data/maps/outside.json");
            await this.loadMap("inside", "data/maps/inside.json");
        } catch (e) {
            console.warn("外部マップファイルの読み込みに失敗。フォールバックデータを使用します。");
            this.loadFallbackMaps();
        }
    },

    async loadMap(id, path) {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        this.mapsData[id] = this.parseMapData(data);
    },

    loadFallbackMaps() {
        const outsideData = {
            width: 30, height: 30,
            legend: {
                "W": { "type": "wall", "passable": false },
                "G": { "type": "grass", "passable": true },
                "~": { "type": "water", "passable": false },
                "D": { "type": "door", "passable": true, "portal": "inside" }
            },
            layout: [
                "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGWWWWGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGWDWWGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGG~~~~~~~~GGGGW",
                "WGGGGGGGGGGGGGGGG~~~~~~~~GGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
                "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
            ]
        };
        const insideData = {
            width: 10, height: 10,
            legend: {
                "W": { "type": "wall", "passable": false },
                "F": { "type": "floor", "passable": true },
                "E": { "type": "door", "passable": true, "portal": "outside" }
            },
            layout: [
                "WWWWWWWWWW",
                "WFFFFFFFFW",
                "WFFFFFFFFW",
                "WFFFFFFFFW",
                "WFFFFFFFFW",
                "WFFFFFFFFW",
                "WFFFFFFFFW",
                "WFFFFFFFFW",
                "WWWWWEWWWW",
                "WWWWWWWWWW"
            ]
        };
        this.mapsData["outside"] = this.parseMapData(outsideData);
        this.mapsData["inside"] = this.parseMapData(insideData);
    },

    parseMapData(data) {
        const grid = [];
        for (let r = 0; r < data.height; r++) {
            const row = [];
            const layoutRow = data.layout[r];
            for (let c = 0; c < data.width; c++) {
                const char = layoutRow[c];
                const tileInfo = data.legend[char] || { type: "wall", passable: false };
                row.push({ type: tileInfo.type, passable: tileInfo.passable, portal: tileInfo.portal });
            }
            grid.push(row);
        }
        return grid;
    },

    getCurrentGrid() {
        return this.mapsData[GameState.currentMap] || [];
    },

    getTileAt(px, py) {
        const col = Math.floor(px / TILE_SIZE);
        const row = Math.floor(py / TILE_SIZE);
        const grid = this.getCurrentGrid();
        if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
            return grid[row][col];
        }
        return { type: "wall", passable: false };
    }
};

const NPCs = [
    {
        id: "granny",
        name: "おばあさん",
        map: "outside",
        x: 8 * TILE_SIZE,
        y: 8 * TILE_SIZE,
        texture: "npc_granny",
        dialogue: [
            "あら、旅のお方。こんにちは。のどかで良いところでしょう。",
            "もし退屈なら、商店の主人に話しかけてみてくださいな。",
            "（薬草を持って話しかけると反応が変わるかもしれない）"
        ],
        onTalk: () => {
            GameState.npcFavorability.granny += 5;
            if (GameState.quests.intro.state === "active" && GameState.player.inventory.includes("herb")) {
                GameState.quests.intro.state = "completed";
                addLog("クエスト「はじめてのお買い物」を達成した！");
                addLog("経験値を50獲得！");
                addExp(50);
            }
        }
    },
    {
        id: "merchant",
        name: "商店の主人",
        map: "inside",
        x: 5 * TILE_SIZE,
        y: 4 * TILE_SIZE,
        texture: "npc_merchant",
        dialogue: ["いらっしゃい。うちの店で何か買っていくかい？"],
        onTalk: () => {
            ShopSystem.open();
        }
    }
];

const PlayerEntity = {
    direction: "down",
    bobbing: 0,
    bobStep: 0,
    lerpSpeed: 0.15,

    update() {
        if (GameState.isBattling) return;
        
        const p = GameState.player;
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        p.x += dx * this.lerpSpeed;
        p.y += dy * this.lerpSpeed;

        const isMoving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;

        if (isMoving) {
            this.bobStep += 0.3;
            this.bobbing = Math.sin(this.bobStep) * 2;
        } else {
            p.x = p.targetX;
            p.y = p.targetY;
            this.bobbing = 0;
            this.checkEncounter();
        }
    },

    move(dir) {
        if (DialogueSystem.isActive || GameState.isBattling) return;
        
        const p = GameState.player;
        if (p.x !== p.targetX || p.y !== p.targetY) return;

        this.direction = dir;
        let nextX = p.targetX;
        let nextY = p.targetY;

        if (dir === "up") nextY -= TILE_SIZE;
        if (dir === "down") nextY += TILE_SIZE;
        if (dir === "left") nextX -= TILE_SIZE;
        if (dir === "right") nextX += TILE_SIZE;

        const tile = MapManager.getTileAt(nextX, nextY);

        let blocked = false;
        NPCs.forEach(npc => {
            if (npc.map === GameState.currentMap && npc.x === nextX && npc.y === nextY) {
                blocked = true;
            }
        });

        if (tile && tile.passable && !blocked) {
            p.targetX = nextX;
            p.targetY = nextY;

            if (tile.portal) {
                setTimeout(() => {
                    transitionArea(tile.portal);
                }, 150);
            }
        }
    },
    
    checkEncounter() {
        const p = GameState.player;
        const targetEnemyIndex = GameState.spawnedEnemies.findIndex(e => Math.abs(e.x - p.x) < 5 && Math.abs(e.y - p.y) < 5);
        if (targetEnemyIndex !== -1) {
            BattleSystem.start(targetEnemyIndex);
        }
    }
};

function transitionArea(targetMap) {
    if (targetMap === "inside") {
        GameState.currentMap = "inside";
        GameState.player.x = GameState.player.targetX = 5 * TILE_SIZE;
        GameState.player.y = GameState.player.targetY = 7 * TILE_SIZE;
        addLog("家の中に入った。");
    } else {
        GameState.currentMap = "outside";
        GameState.player.x = GameState.player.targetX = 12 * TILE_SIZE;
        GameState.player.y = GameState.player.targetY = 7 * TILE_SIZE;
        addLog("外に出て、澄んだ空気を吸い込んだ。");
    }
    SaveSystem.save();
}

const InputHandler = {
    keysPressed: {},

    init() {
        window.addEventListener("keydown", (e) => {
            this.keysPressed[e.code] = true;
            this.handleActionKeys(e.code);
        });
        window.addEventListener("keyup", (e) => {
            this.keysPressed[e.code] = false;
        });

        const setupTouchBtn = (id, direction) => {
            const btn = document.getElementById(id);
            btn.addEventListener("touchstart", (e) => {
                e.preventDefault();
                this.keysPressed[GameState.settings.keys[direction]] = true;
            });
            btn.addEventListener("touchend", (e) => {
                e.preventDefault();
                this.keysPressed[GameState.settings.keys[direction]] = false;
            });
        };

        setupTouchBtn("dpad-up", "up");
        setupTouchBtn("dpad-down", "down");
        setupTouchBtn("dpad-left", "left");
        setupTouchBtn("dpad-right", "right");

        document.getElementById("btn-a").addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.handleActionKeys(GameState.settings.keys.action);
        });

        document.getElementById("btn-b").addEventListener("touchstart", (e) => {
            e.preventDefault();
            UIManager.toggleMenu();
        });
    },

    handleActionKeys(code) {
        if (code === GameState.settings.keys.action) {
            if (DialogueSystem.isActive) {
                DialogueSystem.next();
            } else if (!GameState.isBattling) {
                interact();
            }
        }
        if (code === "KeyM" || code === "Escape") {
            if (!GameState.isBattling) {
                UIManager.toggleMenu();
            }
        }
    },

    update() {
        if (GameState.isBattling) return;
        const k = GameState.settings.keys;
        if (this.keysPressed[k.up]) PlayerEntity.move("up");
        else if (this.keysPressed[k.down]) PlayerEntity.move("down");
        else if (this.keysPressed[k.left]) PlayerEntity.move("left");
        else if (this.keysPressed[k.right]) PlayerEntity.move("right");
    }
};

function interact() {
    const p = GameState.player;
    let targetX = p.targetX;
    let targetY = p.targetY;

    if (PlayerEntity.direction === "up") targetY -= TILE_SIZE;
    if (PlayerEntity.direction === "down") targetY += TILE_SIZE;
    if (PlayerEntity.direction === "left") targetX -= TILE_SIZE;
    if (PlayerEntity.direction === "right") targetX += TILE_SIZE;

    const targetNPC = NPCs.find(npc => npc.map === GameState.currentMap && npc.x === targetX && npc.y === targetY);
    if (targetNPC) {
        DialogueSystem.start(targetNPC.name, targetNPC.dialogue, targetNPC.onTalk);
    }
}

const DialogueSystem = {
    isActive: false,
    name: "",
    lines: [],
    currentIndex: 0,
    callback: null,

    start(name, lines, callback) {
        this.isActive = true;
        this.name = name;
        this.lines = lines;
        this.currentIndex = 0;
        this.callback = callback;
        this.show();
    },

    show() {
        const box = document.getElementById("dialogue-box");
        box.classList.remove("hidden");
        document.getElementById("dialogue-name").innerText = this.name;
        document.getElementById("dialogue-text").innerText = this.lines[this.currentIndex];
    },

    next() {
        this.currentIndex++;
        if (this.currentIndex < this.lines.length) {
            this.show();
        } else {
            this.close();
        }
    },

    close() {
        this.isActive = false;
        document.getElementById("dialogue-box").classList.add("hidden");
        if (this.callback) this.callback();
    }
};

// --- 新規: ターン制バトルシステム ---
const BattleSystem = {
    currentEnemyIndex: -1,
    enemyData: null,
    isPlayerTurn: true,

    start(enemyIndex) {
        GameState.isBattling = true;
        this.currentEnemyIndex = enemyIndex;
        this.enemyData = JSON.parse(JSON.stringify(GameState.spawnedEnemies[enemyIndex]));
        this.isPlayerTurn = true;
        
        document.getElementById("battle-screen").classList.remove("hidden");
        document.getElementById("battle-sub-menu").classList.add("hidden");
        
        this.updateUI();
        this.log(`${this.enemyData.name}が現れた！`);
        this.drawEnemy();
        
        document.getElementById("b-cmd-attack").onclick = () => this.playerAttack();
        document.getElementById("b-cmd-skill").onclick = () => this.showSkills();
        document.getElementById("b-cmd-item").onclick = () => this.showItems();
        document.getElementById("b-cmd-run").onclick = () => this.run();
    },

    log(msg) {
        document.getElementById("battle-message").innerHTML = msg;
    },

    updateUI() {
        const p = GameState.player;
        document.getElementById("battle-enemy-name").innerText = this.enemyData.name;
        const hpPercent = Math.max(0, (this.enemyData.hp / this.enemyData.maxHp) * 100);
        document.getElementById("battle-enemy-hp-fill").style.width = hpPercent + "%";
        
        document.getElementById("b-hp").innerText = p.hp;
        document.getElementById("b-maxhp").innerText = p.maxHp;
        document.getElementById("b-mp").innerText = p.mp;
        document.getElementById("b-maxmp").innerText = p.maxMp;
        
        UIManager.updateUI();
    },

    drawEnemy() {
        const canvas = document.getElementById("battle-enemy-canvas");
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const tex = TextureEngine.canvasCache[this.enemyData.texture];
        if (tex) {
            ctx.drawImage(tex, 0, 0, canvas.width, canvas.height);
        }
    },

    playerAttack() {
        if (!this.isPlayerTurn) return;
        this.isPlayerTurn = false;
        document.getElementById("battle-sub-menu").classList.add("hidden");
        
        const p = GameState.player;
        const damage = Math.max(1, p.str - this.enemyData.vit);
        this.enemyData.hp -= damage;
        this.log(`あなたの攻撃！ ${damage} のダメージを与えた。`);
        this.updateUI();
        
        setTimeout(() => this.checkWinOrEnemyTurn(), 1500);
    },

    showSkills() {
        if (!this.isPlayerTurn) return;
        const sub = document.getElementById("battle-sub-menu");
        sub.innerHTML = "";
        
        GameState.player.skills.forEach(skillId => {
            const skill = SKILL_DATABASE[skillId];
            if (skill) {
                const btn = document.createElement("button");
                btn.className = "sub-cmd-btn";
                btn.innerText = `${skill.name} (MP: ${skill.mpCost})`;
                btn.onclick = () => this.useSkill(skillId);
                sub.appendChild(btn);
            }
        });
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "sub-cmd-btn";
        cancelBtn.innerText = "キャンセル";
        cancelBtn.onclick = () => sub.classList.add("hidden");
        sub.appendChild(cancelBtn);
        
        sub.classList.remove("hidden");
    },

    useSkill(skillId) {
        const skill = SKILL_DATABASE[skillId];
        const p = GameState.player;
        
        if (p.mp < skill.mpCost) {
            this.log("MPが足りない！");
            return;
        }
        
        document.getElementById("battle-sub-menu").classList.add("hidden");
        this.isPlayerTurn = false;
        p.mp -= skill.mpCost;
        
        if (skill.type === "attack") {
            const damage = Math.max(1, Math.floor(p.str * skill.power) - this.enemyData.vit);
            this.enemyData.hp -= damage;
            this.log(`${skill.name}！ ${damage} のダメージを与えた！`);
        } else if (skill.type === "heal") {
            p.hp = Math.min(p.maxHp, p.hp + skill.power);
            this.log(`${skill.name}！ HPが ${skill.power} 回復した。`);
        }
        
        this.updateUI();
        setTimeout(() => this.checkWinOrEnemyTurn(), 1500);
    },

    showItems() {
        if (!this.isPlayerTurn) return;
        const sub = document.getElementById("battle-sub-menu");
        sub.innerHTML = "";
        
        const uniqueItems = [...new Set(GameState.player.inventory)];
        if (uniqueItems.length === 0) {
            sub.innerHTML = "<div style='padding:10px;'>アイテムを持っていない</div>";
        }
        
        uniqueItems.forEach(itemId => {
            const item = ITEM_DATABASE[itemId];
            const count = GameState.player.inventory.filter(id => id === itemId).length;
            if (item) {
                const btn = document.createElement("button");
                btn.className = "sub-cmd-btn";
                btn.innerText = `${item.name} x${count}`;
                btn.onclick = () => this.useItem(itemId);
                sub.appendChild(btn);
            }
        });
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "sub-cmd-btn";
        cancelBtn.innerText = "キャンセル";
        cancelBtn.onclick = () => sub.classList.add("hidden");
        sub.appendChild(cancelBtn);
        
        sub.classList.remove("hidden");
    },

    useItem(itemId) {
        document.getElementById("battle-sub-menu").classList.add("hidden");
        this.isPlayerTurn = false;
        const p = GameState.player;
        const idx = p.inventory.indexOf(itemId);
        p.inventory.splice(idx, 1);
        
        if (itemId === "herb") {
            p.hp = Math.min(p.maxHp, p.hp + 30);
            this.log("薬草を使った！ HPが30回復した。");
        } else if (itemId === "potion") {
            p.hp = p.maxHp;
            this.log("魔導ポーションを使った！ HPが全快した。");
        } else if (itemId === "ether") {
            p.mp = Math.min(p.maxMp, p.mp + 20);
            this.log("エーテルを使った！ MPが20回復した。");
        } else {
            this.log(`${ITEM_DATABASE[itemId].name}を使った！ ...しかし何も起こらなかった。`);
        }
        
        this.updateUI();
        setTimeout(() => this.checkWinOrEnemyTurn(), 1500);
    },

    run() {
        if (!this.isPlayerTurn) return;
        document.getElementById("battle-sub-menu").classList.add("hidden");
        this.isPlayerTurn = false;
        
        if (Math.random() < 0.7) {
            this.log("無事に逃げ切った！");
            setTimeout(() => this.endBattle(false), 1000);
        } else {
            this.log("逃げられない！");
            setTimeout(() => this.enemyTurn(), 1500);
        }
    },

    checkWinOrEnemyTurn() {
        if (this.enemyData.hp <= 0) {
            this.enemyData.hp = 0;
            this.updateUI();
            this.log(`${this.enemyData.name}を倒した！`);
            setTimeout(() => this.processWin(), 1500);
        } else {
            this.enemyTurn();
        }
    },

    enemyTurn() {
        const damage = Math.max(1, this.enemyData.str - GameState.player.vit);
        GameState.player.hp -= damage;
        this.log(`${this.enemyData.name}の攻撃！ ${damage} のダメージを受けた。`);
        this.updateUI();
        
        if (GameState.player.hp <= 0) {
            setTimeout(() => {
                this.log("あなたは力尽きた...");
                setTimeout(() => {
                    GameState.player.hp = GameState.player.maxHp;
                    GameState.player.mp = GameState.player.maxMp;
                    GameState.player.x = GameState.player.targetX = 5 * TILE_SIZE;
                    GameState.player.y = GameState.player.targetY = 5 * TILE_SIZE;
                    GameState.currentMap = "outside";
                    this.endBattle(false);
                }, 2000);
            }, 1500);
        } else {
            setTimeout(() => {
                this.log("あなたの番だ！");
                this.isPlayerTurn = true;
            }, 1000);
        }
    },

    processWin() {
        addExp(this.enemyData.rewardExp);
        GameState.player.gold += this.enemyData.rewardGold;
        this.log(`経験値を ${this.enemyData.rewardExp}、お金を ${this.enemyData.rewardGold}G 獲得した！`);
        
        if (GameState.quests.extermination.state === "active") {
            GameState.quests.extermination.currentCount++;
            if (GameState.quests.extermination.currentCount >= GameState.quests.extermination.targetCount) {
                GameState.quests.extermination.state = "completed";
                addLog("クエスト「水辺の害虫駆除」達成！");
            }
        }
        
        setTimeout(() => this.endBattle(true), 2000);
    },

    endBattle(isWin) {
        if (isWin) {
            GameState.spawnedEnemies.splice(this.currentEnemyIndex, 1);
        }
        GameState.isBattling = false;
        document.getElementById("battle-screen").classList.add("hidden");
        SaveSystem.save();
        UIManager.updateUI();
    }
};

const EnemySpawner = {
    lastSpawnTime: 0,
    spawnInterval: 5000,

    update(timestamp) {
        if (GameState.currentMap !== "outside" || GameState.isBattling) return;

        if (!this.lastSpawnTime) this.lastSpawnTime = timestamp;
        if (timestamp - this.lastSpawnTime > this.spawnInterval) {
            this.lastSpawnTime = timestamp;
            if (GameState.spawnedEnemies.length < 4) {
                this.spawnRandomEnemy();
            }
        }
    },

    spawnRandomEnemy() {
        const grid = MapManager.getCurrentGrid();
        if (grid.length === 0) return;
        
        let attempts = 0;
        const maxRows = grid.length;
        const maxCols = grid[0].length;

        while (attempts < 100) {
            const r = Math.floor(Math.random() * (maxRows - 2)) + 1;
            const c = Math.floor(Math.random() * (maxCols - 2)) + 1;
            
            if (grid[r][c].passable && !this.isEnemyAt(c * TILE_SIZE, r * TILE_SIZE)) {
                GameState.spawnedEnemies.push({
                    name: "水辺のスライム",
                    x: c * TILE_SIZE,
                    y: r * TILE_SIZE,
                    hp: 30,
                    maxHp: 30,
                    str: 12,
                    vit: 4,
                    rewardExp: 35,
                    rewardGold: 15,
                    texture: "enemy_slime"
                });
                break;
            }
            attempts++;
        }
    },

    isEnemyAt(x, y) {
        return GameState.spawnedEnemies.some(e => e.x === x && e.y === y);
    }
};

function addExp(amount) {
    const p = GameState.player;
    p.exp += amount;
    let nextExp = p.level * 100;
    while (p.exp >= nextExp) {
        p.exp -= nextExp;
        p.level++;
        p.maxHp += 15;
        p.hp = p.maxHp;
        p.maxMp += 10;
        p.mp = p.maxMp;
        p.sp += 5; // レベルアップでSP獲得
        addLog(`レベルアップ！ レベル ${p.level} に到達！ 5 SPを獲得した！`);
        nextExp = p.level * 100;
    }
    UIManager.updateUI();
}

const ShopSystem = {
    isOpen: false,

    open() {
        this.isOpen = true;
        document.getElementById("shop-window").classList.remove("hidden");
        this.render();
    },

    close() {
        this.isOpen = false;
        document.getElementById("shop-window").classList.add("hidden");
    },

    render() {
        const buyList = document.getElementById("shop-buy-list");
        buyList.innerHTML = "";
        
        Object.values(ITEM_DATABASE).forEach(item => {
            const row = document.createElement("div");
            row.className = "item-row";
            row.innerHTML = `
                <span>${item.name} (${item.cost}G)</span>
                <button onclick="ShopSystem.buy('${item.id}')">購入</button>
            `;
            buyList.appendChild(row);
        });

        const sellList = document.getElementById("shop-sell-list");
        sellList.innerHTML = "";

        GameState.player.inventory.forEach((itemId, idx) => {
            const item = ITEM_DATABASE[itemId];
            if (item) {
                const row = document.createElement("div");
                row.className = "item-row";
                row.innerHTML = `
                    <span>${item.name} (+${item.sellValue}G)</span>
                    <button onclick="ShopSystem.sell(${idx})">売却</button>
                `;
                sellList.appendChild(row);
            }
        });
    },

    buy(itemId) {
        const item = ITEM_DATABASE[itemId];
        if (GameState.player.gold >= item.cost) {
            GameState.player.gold -= item.cost;
            GameState.player.inventory.push(itemId);
            addLog(`${item.name}を購入した。`);
            this.render();
            UIManager.updateUI();
            SaveSystem.save();
        } else {
            addLog("お金が足りません！");
        }
    },

    sell(index) {
        const itemId = GameState.player.inventory[index];
        const item = ITEM_DATABASE[itemId];
        if (item) {
            GameState.player.gold += item.sellValue;
            GameState.player.inventory.splice(index, 1);
            addLog(`${item.name}を売却した。`);
            this.render();
            UIManager.updateUI();
            SaveSystem.save();
        }
    }
};
window.ShopSystem = ShopSystem;

const SaveSystem = {
    saveKey: "procedural_rpg_save_v1",

    save() {
        localStorage.setItem(this.saveKey, JSON.stringify(GameState));
    },

    load() {
        const data = localStorage.getItem(this.saveKey);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                GameState = { ...GameState, ...parsed };
                // 互換性チェック(新規追加プロパティの補完)
                if (GameState.player.sp === undefined) GameState.player.sp = 0;
                if (GameState.player.mp === undefined) {
                    GameState.player.maxMp = 30;
                    GameState.player.mp = 30;
                    GameState.player.skills = ["power_slash", "heal"];
                }
                GameState.player.targetX = GameState.player.x;
                GameState.player.targetY = GameState.player.y;
                GameState.isBattling = false;
                addLog("セーブデータをロードしました。");
            } catch (e) {
                addLog("セーブデータの破損を検知しました。再作成します。");
                this.reset();
            }
        } else {
            this.save();
        }
    },

    reset() {
        localStorage.removeItem(this.saveKey);
        window.location.reload();
    }
};

const UIManager = {
    init() {
        document.querySelectorAll(".tab-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
                
                btn.classList.add("active");
                const targetPanelId = btn.getAttribute("data-tab");
                document.getElementById(targetPanelId).classList.remove("hidden");
            });
        });

        document.getElementById("menu-toggle-btn").addEventListener("click", () => this.toggleMenu());
        document.getElementById("menu-close-btn").addEventListener("click", () => this.toggleMenu());
        document.getElementById("shop-close-btn").addEventListener("click", () => ShopSystem.close());

        document.getElementById("reset-save-btn").addEventListener("click", () => {
            if (confirm("ゲームデータを完全に削除しますか？")) {
                SaveSystem.reset();
            }
        });

        document.getElementById("toggle-touch-controls").addEventListener("click", () => {
            GameState.settings.showTouch = !GameState.settings.showTouch;
            this.applySettingsUI();
            SaveSystem.save();
        });

        document.querySelectorAll(".key-binder").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const action = btn.getAttribute("data-action");
                btn.innerText = "キー入力待ち...";
                
                const keyListener = (event) => {
                    GameState.settings.keys[action] = event.code;
                    btn.innerText = event.code;
                    window.removeEventListener("keydown", keyListener);
                    addLog(`バインド変更: ${action} -> ${event.code}`);
                    this.applySettingsUI();
                    SaveSystem.save();
                };
                window.addEventListener("keydown", keyListener);
            });
        });

        this.applySettingsUI();
        this.updateUI();
    },

    toggleMenu() {
        const menu = document.getElementById("menu-window");
        menu.classList.toggle("hidden");
        this.updateUI();
    },

    applySettingsUI() {
        const pad = document.getElementById("virtual-pad");
        const controlsHud = document.getElementById("controls-hud");
        
        if (GameState.settings.showTouch) {
            pad.classList.remove("hidden");
            controlsHud.classList.add("hidden"); 
        } else {
            pad.classList.add("hidden");
            controlsHud.classList.remove("hidden");
        }

        document.querySelectorAll(".key-binder").forEach(btn => {
            const action = btn.getAttribute("data-action");
            btn.innerText = GameState.settings.keys[action] || "None";
        });

        const formatKey = (code) => code.replace('Key', '').replace('Arrow', '');
        document.getElementById("hud-key-up").innerText = formatKey(GameState.settings.keys.up);
        document.getElementById("hud-key-left").innerText = formatKey(GameState.settings.keys.left);
        document.getElementById("hud-key-down").innerText = formatKey(GameState.settings.keys.down);
        document.getElementById("hud-key-right").innerText = formatKey(GameState.settings.keys.right);
        document.getElementById("hud-key-action").innerText = formatKey(GameState.settings.keys.action);
        document.getElementById("dialogue-key-action").innerText = formatKey(GameState.settings.keys.action);
    },

    allocateSP(stat) {
        if (GameState.player.sp > 0) {
            GameState.player.sp--;
            GameState.player[stat]++;
            this.updateUI();
            SaveSystem.save();
        }
    },

    updateUI() {
        const p = GameState.player;
        
        document.getElementById("hp-val").innerText = p.hp;
        document.getElementById("hp-max-val").innerText = p.maxHp;
        document.getElementById("mp-val").innerText = p.mp;
        document.getElementById("mp-max-val").innerText = p.maxMp;
        document.getElementById("lv-val").innerText = p.level;
        document.getElementById("exp-val").innerText = p.exp;
        
        const nextExp = p.level * 100;
        document.getElementById("exp-next-val").innerText = nextExp;
        document.getElementById("gold-val").innerText = p.gold;

        document.getElementById("stat-lv").innerText = p.level;
        document.getElementById("stat-exp").innerText = `${p.exp} / ${nextExp}`;
        
        document.getElementById("stat-sp").innerText = p.sp;
        document.getElementById("stat-str").innerText = p.str;
        document.getElementById("stat-agi").innerText = p.agi;
        document.getElementById("stat-vit").innerText = p.vit;

        document.querySelectorAll(".sp-btn").forEach(btn => {
            btn.disabled = p.sp <= 0;
        });

        const skillsListDiv = document.getElementById("stat-skills-list");
        skillsListDiv.innerHTML = "";
        p.skills.forEach(skillId => {
            const skill = SKILL_DATABASE[skillId];
            if (skill) {
                const row = document.createElement("div");
                row.className = "skill-row";
                row.innerHTML = `<strong>${skill.name}</strong> <span>MP: ${skill.mpCost} / ${skill.description}</span>`;
                skillsListDiv.appendChild(row);
            }
        });

        const invList = document.getElementById("inventory-list");
        invList.innerHTML = "";
        p.inventory.forEach((itemId, idx) => {
            const item = ITEM_DATABASE[itemId];
            if (item) {
                const row = document.createElement("div");
                row.className = "item-row";
                row.innerHTML = `
                    <span><strong>${item.name}</strong> - ${item.description}</span>
                    <button onclick="useItem(${idx})">使う</button>
                `;
                invList.appendChild(row);
            }
        });

        const questListDiv = document.getElementById("quest-list");
        questListDiv.innerHTML = "";
        Object.values(GameState.quests).forEach(q => {
            const row = document.createElement("div");
            row.className = "quest-row";
            
            let statusText = "未受注";
            if (q.state === "active") {
                statusText = q.targetCount ? `進行中 (${q.currentCount}/${q.targetCount})` : "進行中";
            } else if (q.state === "completed") {
                statusText = "完了済み";
            }

            row.innerHTML = `
                <div>
                    <strong>${q.title}</strong><br>
                    <small>${q.description}</small>
                </div>
                <span>[${statusText}]</span>
            `;
            
            if (q.state === "unlocked") {
                const actBtn = document.createElement("button");
                actBtn.innerText = "受託";
                actBtn.onclick = () => {
                    q.state = "active";
                    addLog(`クエストを受けました: ${q.title}`);
                    UIManager.updateUI();
                    SaveSystem.save();
                };
                row.appendChild(actBtn);
            }

            questListDiv.appendChild(row);
        });
    }
};
window.UIManager = UIManager;

window.useItem = function(index) {
    const p = GameState.player;
    const itemId = p.inventory[index];
    if (itemId === "herb") {
        p.hp = Math.min(p.maxHp, p.hp + 30);
        addLog("薬草を使用してHPを30回復しました。");
        p.inventory.splice(index, 1);
    } else if (itemId === "potion") {
        p.hp = p.maxHp;
        addLog("極上の魔導ポーションを使用してHPを全快しました。");
        p.inventory.splice(index, 1);
    } else if (itemId === "ether") {
        p.mp = Math.min(p.maxMp, p.mp + 20);
        addLog("エーテルを使用してMPを20回復しました。");
        p.inventory.splice(index, 1);
    } else {
        addLog("ここでは使用できません。");
    }
    UIManager.updateUI();
    SaveSystem.save();
};

function addLog(text) {
    const logContainer = document.getElementById("message-log");
    const div = document.createElement("div");
    div.className = "log-message";
    div.innerText = text;
    logContainer.appendChild(div);

    if (logContainer.childNodes.length > 5) {
        logContainer.removeChild(logContainer.firstChild);
    }
    setTimeout(() => {
        if (div.parentNode) {
            logContainer.removeChild(div);
        }
    }, 3000);
}

const DebugConsole = {
    init() {
        const input = document.getElementById("debug-input");
        const output = document.getElementById("debug-output");

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const cmd = input.value.trim();
                input.value = "";
                this.execute(cmd, output);
            }
        });
    },

    execute(cmdText, outputDiv) {
        const args = cmdText.split(" ");
        const baseCmd = args[0].toLowerCase();
        let logText = `> ${cmdText}\n`;
        const p = GameState.player;

        if (baseCmd === "help") {
            logText += "使用可能: gold, lv, warp, npc, sp, str, agi, vit, hp, mp, skill [id]";
        } else if (baseCmd === "gold") {
            const val = parseInt(args[1]) || 1000;
            p.gold += val;
            logText += `ゴールドを +${val}G 追加しました。`;
        } else if (baseCmd === "lv") {
            const val = parseInt(args[1]) || 10;
            p.level = val;
            logText += `レベルを強制的に ${val} に変更しました。`;
            addExp(0);
        } else if (baseCmd === "sp") {
            const val = parseInt(args[1]) || 10;
            p.sp += val;
            logText += `SPを +${val} 追加しました。`;
        } else if (baseCmd === "str" || baseCmd === "agi" || baseCmd === "vit") {
            const val = parseInt(args[1]) || 10;
            p[baseCmd] = val;
            logText += `${baseCmd.toUpperCase()} を ${val} に変更しました。`;
        } else if (baseCmd === "hp" || baseCmd === "mp") {
            const val = parseInt(args[1]) || 100;
            p[baseCmd] = val;
            p[`max${baseCmd.charAt(0).toUpperCase() + baseCmd.slice(1)}`] = val;
            logText += `最大${baseCmd.toUpperCase()} を ${val} に変更し全快させました。`;
        } else if (baseCmd === "skill") {
            const skillId = args[1];
            if (SKILL_DATABASE[skillId] && !p.skills.includes(skillId)) {
                p.skills.push(skillId);
                logText += `スキル [${skillId}] を強制習得しました。`;
            } else {
                logText += "スキルIDが無効か既に習得済みです。";
            }
        } else if (baseCmd === "warp") {
            const mapId = args[1];
            if (mapId === "outside" || mapId === "inside") {
                transitionArea(mapId);
                logText += `エリア [${mapId}] にワープしました。`;
            } else {
                logText += "引数エラー: warp outside または warp inside";
            }
        } else if (baseCmd === "npc") {
            const npcId = args[1];
            const targetNPC = NPCs.find(n => n.id === npcId);
            if (targetNPC) {
                targetNPC.x = p.x;
                targetNPC.y = p.y;
                logText += `NPC [${npcId}] を現在地に召喚しました。`;
            } else {
                logText += "NPCが見つかりません。";
            }
        } else {
            logText += "不明なコマンド。'help' を参照してください。";
        }

        outputDiv.innerText += `\n${logText}`;
        outputDiv.scrollTop = outputDiv.scrollHeight;
        UIManager.updateUI();
        SaveSystem.save();
    }
};

function gameLoop(timestamp) {
    update(timestamp);
    render();
    renderMinimap();
    requestAnimationFrame(gameLoop);
}

function update(timestamp) {
    InputHandler.update();
    PlayerEntity.update();
    EnemySpawner.update(timestamp);
}

function render() {
    ctx.clearRect(0, 0, Canvas.width, Canvas.height);

    const grid = MapManager.getCurrentGrid();
    if (grid.length === 0) return;
    
    const camX = GameState.player.x - Canvas.width / 2 + TILE_SIZE / 2;
    const camY = GameState.player.y - Canvas.height / 2 + TILE_SIZE / 2;

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const px = c * TILE_SIZE;
            const py = r * TILE_SIZE;

            if (px < camX - TILE_SIZE || px > camX + Canvas.width ||
                py < camY - TILE_SIZE || py > camY + Canvas.height) {
                continue;
            }

            const cell = grid[r][c];
            const texture = TextureEngine.canvasCache[cell.type];
            if (texture) {
                ctx.drawImage(texture, px - camX, py - camY, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    NPCs.forEach(npc => {
        if (npc.map === GameState.currentMap) {
            const tex = TextureEngine.canvasCache[npc.texture];
            if (tex) {
                ctx.drawImage(tex, npc.x - camX, npc.y - camY, TILE_SIZE, TILE_SIZE);
            }
        }
    });

    if (GameState.currentMap === "outside") {
        GameState.spawnedEnemies.forEach(e => {
            const tex = TextureEngine.canvasCache[e.texture];
            if (tex) {
                ctx.drawImage(tex, e.x - camX, e.y - camY, TILE_SIZE, TILE_SIZE);
            }
        });
    }

    const pTexName = `player_${PlayerEntity.direction}`;
    const pTex = TextureEngine.canvasCache[pTexName];
    if (pTex) {
        ctx.drawImage(
            pTex, 
            GameState.player.x - camX, 
            GameState.player.y - camY + PlayerEntity.bobbing, 
            TILE_SIZE, 
            TILE_SIZE
        );
    }
}

function renderMinimap() {
    const minimapCanvas = document.getElementById("minimap-canvas");
    if (!minimapCanvas) return;
    const mCtx = minimapCanvas.getContext("2d");
    mCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    const grid = MapManager.getCurrentGrid();
    if (grid.length === 0) return;
    
    const cellSize = 4;
    const viewTiles = 20; 
    
    const playerGridC = Math.floor(GameState.player.x / TILE_SIZE);
    const playerGridR = Math.floor(GameState.player.y / TILE_SIZE);
    
    const startC = playerGridC - Math.floor(viewTiles / 2);
    const startR = playerGridR - Math.floor(viewTiles / 2);
    
    for (let r = 0; r < viewTiles; r++) {
        for (let c = 0; c < viewTiles; c++) {
            const mapR = startR + r;
            const mapC = startC + c;
            
            if (mapR >= 0 && mapR < grid.length && mapC >= 0 && mapC < grid[0].length) {
                const type = grid[mapR][mapC].type;
                if (type === 'wall') mCtx.fillStyle = '#555555';
                else if (type === 'water') mCtx.fillStyle = '#3b7ecb';
                else if (type === 'grass') mCtx.fillStyle = '#4a9c3d';
                else if (type === 'floor') mCtx.fillStyle = '#8a5229';
                else if (type === 'door') mCtx.fillStyle = '#bf431b';
                else mCtx.fillStyle = '#000000';
            } else {
                mCtx.fillStyle = '#000000';
            }
            mCtx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
    }
    
    mCtx.fillStyle = '#ff0000';
    const playerXOnMinimap = Math.floor(viewTiles / 2) * cellSize;
    const playerYOnMinimap = Math.floor(viewTiles / 2) * cellSize;
    mCtx.fillRect(playerXOnMinimap, playerYOnMinimap, cellSize, cellSize);
}

window.addEventListener("DOMContentLoaded", async () => {
    TextureEngine.init();
    await MapManager.init();
    SaveSystem.load();
    InputHandler.init();
    UIManager.init();
    DebugConsole.init();

    requestAnimationFrame(gameLoop);
});
