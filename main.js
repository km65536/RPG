/**
 * Procedural Pixel RPG - Main Game Script
 *
 * データ定義 (アイテム/スキル/敵/クエスト/マップ) は data/*.js に分離されている。
 * このファイルより先に以下の順で読み込むこと (index.html 側で設定済み):
 *   data/constants.js -> data/items.js -> data/skills.js
 *   -> data/enemies.js -> data/quests.js -> maps/*.js -> main.js
 */

// アイテムの種類/スロットに応じた絵文字アイコンを返す (商店・所持品・鍛冶場の表示で使用)
function getItemIcon(item) {
    if (!item) return "❓";
    if (item.type === "consumable") {
        if (item.effect && item.effect.stat === "hp") return "🧪";
        if (item.effect && item.effect.stat === "mp") return "💧";
        return "🧴";
    }
    if (item.type === "skill_book") return "📖";
    if (item.type === "equipment") {
        switch (item.slot) {
            case "head": return "🎩";
            case "body": return "🥋";
            case "feet": return "👢";
            case "neck": return "📿";
            case "leftHand": return "🛡️";
            case "rightHand": return "🗡️";
            default: return "⚙️";
        }
    }
    return "📦";
}

function getEnhanceCost(item, currentLevel) {
    return Math.round(item.cost * (currentLevel + 1) * 1.2);
}

// --- 装備インスタンス (強化レベル/一意なIDを持つ) ---
let itemUidCounter = 0;
function generateItemUid(itemId) {
    itemUidCounter += 1;
    return `${itemId}_${Date.now().toString(36)}_${itemUidCounter}`;
}
function createEquipmentInstance(itemId, level = 0) {
    return { itemId, level: Math.max(0, Math.min(MAX_ENHANCE_LEVEL, level)), uid: generateItemUid(itemId) };
}

let GameState = {
    player: {
        name: "Player",
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
        // レベルアップのみで決まる「素」のステータス。装備・スキルのボーナスはここには含めない。
        baseStats: { maxHp: 100, maxMp: 30, str: 10, agi: 10, vit: 10 },
        // 各スロットに装備中のアイテムインスタンス ({ itemId, level, uid }、未装備は null)
        equipment: { head: null, body: null, feet: null, neck: null, leftHand: null, rightHand: null },
        // 所持品: 消費アイテム/スキルブックは文字列ID、装備品はインスタンスオブジェクト
        inventory: ["herb", "ether"],
        skills: ["power_slash", "heal"],
        skillLevels: { power_slash: 1, heal: 1 }
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
    isBattling: false,
    dungeonBossDefeated: false
};

// 属性相性: 弱点なら1.5倍、耐性なら0.5倍のダメージになる
function getElementMultiplier(element, enemy) {
    if (!element || !enemy) return 1;
    if (enemy.weakness === element) return 1.5;
    if (enemy.resist === element) return 0.5;
    return 1;
}

function getElementFlavorText(multiplier) {
    if (multiplier > 1) return " 弱点をついた！";
    if (multiplier < 1) return " 耐性で軽減された…";
    return "";
}

function startQuest(questId) {
    const q = GameState.quests[questId];
    if (!q || q.state !== "unlocked") return;
    q.state = "active";
    addLog(`クエストを受けました: ${q.title}`);
    UIManager.updateUI();
    SaveSystem.save();
}

// カウント制クエストを1進める。目標数に達したら自動的に完了扱いにする。
function progressQuest(questId) {
    const q = GameState.quests[questId];
    if (!q || q.state !== "active") return;
    q.currentCount = (q.currentCount || 0) + 1;
    if (q.currentCount >= q.targetCount) {
        completeQuest(questId);
    } else {
        UIManager.updateUI();
        SaveSystem.save();
    }
}

// クエストを完了状態にする (報酬はまだ受け取っていない)
function completeQuest(questId) {
    const q = GameState.quests[questId];
    if (!q || q.state === "completed" || q.state === "claimed") return;
    if (q.state !== "active") return;
    q.state = "completed";
    addLog(`クエスト達成: ${q.title}`);
    unlockFollowupQuests(questId);
    UIManager.updateUI();
    SaveSystem.save();
}

// 完了済みクエストの報酬を受け取り、claimed 状態にする
function claimQuestReward(questId) {
    const q = GameState.quests[questId];
    if (!q || q.state !== "completed") return;
    const def = QUEST_DATABASE[questId];
    const reward = (def && def.reward) || {};
    const p = GameState.player;

    if (reward.exp) addExp(reward.exp);
    if (reward.gold) p.gold += reward.gold;
    if (reward.items) {
        reward.items.forEach(entry => {
            const item = ITEM_DATABASE[entry.id];
            if (!item) return;
            for (let i = 0; i < (entry.count || 1); i++) {
                p.inventory.push(item.type === "equipment" ? createEquipmentInstance(entry.id, 0) : entry.id);
            }
        });
    }

    q.state = "claimed";
    addLog(`「${q.title}」の報酬を受け取った！`);
    UIManager.updateUI();
    SaveSystem.save();
}

// 前提クエスト完了時に、それを requires とする locked クエストを unlocked にする
function unlockFollowupQuests(completedQuestId) {
    Object.values(GameState.quests).forEach(q => {
        const def = QUEST_DATABASE[q.id];
        if (def && def.requires === completedQuestId && q.state === "locked") {
            q.state = "unlocked";
            addLog(`新しいクエストが解放された: ${q.title}`);
        }
    });
}

function recalculateStats() {
    const p = GameState.player;
    // レベルから「素」のステータスを算出
    p.baseStats.maxHp = 100 + (p.level - 1) * 20;
    p.baseStats.maxMp = 30 + (p.level - 1) * 10;
    p.baseStats.str = 10 + (p.level - 1) * 4;
    p.baseStats.agi = 10 + (p.level - 1) * 3;
    p.baseStats.vit = 10 + (p.level - 1) * 3;
    // 装備・スキルのボーナスを反映した最終値を p.maxHp などに反映
    updateEffectiveStats();
}

// 現在装備中のアイテムインスタンス一覧を返す
function getEquippedItems() {
    return SLOT_ORDER.map(slot => GameState.player.equipment[slot]).filter(Boolean);
}

// 装備品による指定ステータスの合計ボーナスを返す (強化レベルに応じて増幅)
function getEquipmentBonus(statKey) {
    return getEquippedItems().reduce((sum, instance) => {
        const item = ITEM_DATABASE[instance.itemId];
        if (!item || !item.stats || !item.stats[statKey]) return sum;
        const scaled = Math.round(item.stats[statKey] * (1 + ENHANCE_BONUS_PER_LEVEL * instance.level));
        return sum + scaled;
    }, 0);
}

// 装備品による特殊効果 (経験値ブーストなど) の合計値を返す
function getEquipmentSpecialEffectValue(effectType) {
    return getEquippedItems().reduce((sum, instance) => {
        const item = ITEM_DATABASE[instance.itemId];
        if (item && item.specialEffect && item.specialEffect.type === effectType) {
            return sum + item.specialEffect.value;
        }
        return sum;
    }, 0);
}

// 習得済みパッシブスキルによる指定ステータスの合計ボーナスを返す
function getSkillStatBonus(statKey) {
    const p = GameState.player;
    return p.skills.reduce((sum, skillId) => {
        const skill = SKILL_DATABASE[skillId];
        if (skill && skill.type === "passive_stat" && skill.statKey === statKey) {
            const slv = p.skillLevels[skillId] || 1;
            return sum + skill.valuePerLevel * slv;
        }
        return sum;
    }, 0);
}

// スキル・装備の両方から特殊効果 (経験値/ゴールドブーストなど) の合計値を返す
function getPassiveSpecialValue(effectType) {
    const p = GameState.player;
    let total = getEquipmentSpecialEffectValue(effectType);
    p.skills.forEach(skillId => {
        const skill = SKILL_DATABASE[skillId];
        if (skill && skill.type === "passive_special" && skill.effectType === effectType) {
            const slv = p.skillLevels[skillId] || 1;
            total += skill.baseValue + (slv - 1) * skill.valuePerLevel;
        }
    });
    return total;
}

// baseStats + 装備ボーナス + スキルボーナス を実際に使用する最終ステータスに反映する
function updateEffectiveStats() {
    const p = GameState.player;
    p.maxHp = p.baseStats.maxHp + getEquipmentBonus("maxHp") + getSkillStatBonus("maxHp");
    p.maxMp = p.baseStats.maxMp + getEquipmentBonus("maxMp") + getSkillStatBonus("maxMp");
    p.str = p.baseStats.str + getEquipmentBonus("str") + getSkillStatBonus("str");
    p.agi = p.baseStats.agi + getEquipmentBonus("agi") + getSkillStatBonus("agi");
    p.vit = p.baseStats.vit + getEquipmentBonus("vit") + getSkillStatBonus("vit");
    // 装備を外して最大値が下がった場合に現在値が超過しないようクランプ
    p.hp = Math.min(p.hp, p.maxHp);
    p.mp = Math.min(p.mp, p.maxMp);
}

// ユニークスキルを付与する (console, lucky_charm など、スキルブックでは手に入らない特別な入手経路用)
function unlockUniqueSkill(skillId) {
    const p = GameState.player;
    const skill = SKILL_DATABASE[skillId];
    if (!skill || p.skills.includes(skillId)) return;
    p.skills.push(skillId);
    addLog(`ユニークスキル「${skill.name}」を習得した！`);
    UIManager.updateUI();
    SaveSystem.save();
    if (skillId === "console") {
        const debugPanel = document.getElementById("debug-panel");
        if (debugPanel) debugPanel.classList.remove("hidden");
    }
}

function addExp(amount) {
    const p = GameState.player;
    p.exp += amount;
    let leveledUp = false;
    let gainedSpTotal = 0;
    
    while (p.exp >= p.level * 100) {
        p.exp -= p.level * 100;
        p.level++;
        p.sp += 5;
        gainedSpTotal += 5;
        leveledUp = true;
    }

    if (leveledUp) {
        recalculateStats();
        p.hp = p.maxHp;
        p.mp = p.maxMp;
        const msg = `レベルアップ！ レベル ${p.level} に到達！ ${gainedSpTotal} SPを獲得した！`;
        addLog(msg);
        
        if (GameState.isBattling) {
            BattleSystem.appendLog(`<br><span style="color: #ff0;">${msg}</span>`);
        }
    }
    
    UIManager.updateUI();
    SaveSystem.save();
}

const TextureEngine = {
    canvasCache: {},
    // 全テクスチャの内部解像度 (TILE_SIZEへ拡大縮小されて描画される)
    RES: 16,

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
        const R = this.RES;

        this.create("grass", R, R, (ctx) => {
            ctx.fillStyle = "#4a9c3d";
            ctx.fillRect(0, 0, R, R);
            ctx.fillStyle = "#3e8c31";
            ctx.fillRect(2, 4, 2, 2);
            ctx.fillRect(10, 2, 2, 2);
            ctx.fillRect(6, 11, 2, 2);
            ctx.fillRect(12, 12, 2, 2);
            ctx.fillStyle = "#5aab4d";
            ctx.fillRect(4, 8, 2, 2);
        });

        this.create("water", R, R, (ctx) => {
            ctx.fillStyle = "#3b7ecb";
            ctx.fillRect(0, 0, R, R);
            ctx.fillStyle = "#2a6dbb";
            ctx.fillRect(1, 1, 14, 1);
            ctx.fillRect(4, 8, 8, 1);
            ctx.fillStyle = "#7db3e8";
            ctx.fillRect(9, 4, 2, 1);
            ctx.fillRect(3, 11, 2, 1);
        });

        this.create("floor", R, R, (ctx) => {
            ctx.fillStyle = "#8a5229";
            ctx.fillRect(0, 0, R, R);
            ctx.fillStyle = "#6e3f1d";
            ctx.fillRect(0, 5, R, 1);
            ctx.fillRect(0, 10, R, 1);
            ctx.fillRect(0, 15, R, 1);
            ctx.fillStyle = "#96602f";
            ctx.fillRect(3, 1, 6, 1);
            ctx.fillRect(9, 11, 5, 1);
        });

        this.create("wall", R, R, (ctx) => {
            ctx.fillStyle = "#555555";
            ctx.fillRect(0, 0, R, R);
            ctx.fillStyle = "#333333";
            ctx.fillRect(0, 0, R, 1);
            ctx.fillRect(0, 8, R, 1);
            ctx.fillRect(0, 0, 1, R);
            ctx.fillRect(8, 0, 1, 8);
            ctx.fillRect(4, 8, 1, 8);
            ctx.fillStyle = "#777777";
            ctx.fillRect(1, 1, 6, 6);
            ctx.fillRect(9, 1, 6, 6);
            ctx.fillRect(5, 9, 6, 6);
        });

        this.create("door", R, R, (ctx) => {
            ctx.fillStyle = "#6e3f1d";
            ctx.fillRect(0, 0, R, R);
            ctx.fillStyle = "#bf431b";
            ctx.fillRect(1, 1, 14, 14);
            ctx.fillStyle = "#7c2b11";
            ctx.fillRect(3, 2, 10, 5);
            ctx.fillRect(3, 9, 10, 5);
            ctx.fillStyle = "#ffd700";
            ctx.fillRect(11, 8, 2, 2);
        });

        // 建物のタイルセットを共通描画するヘルパー。roof/wall/window の3種を組み合わせて
        // 複数タイルにまたがる「ちゃんとした建物」を作る。
        const drawBuildingSet = (prefix, roofColor, roofDark, wallColor, wallDark, trimColor) => {
            this.create(`roof_${prefix}`, R, R, (ctx) => {
                ctx.fillStyle = roofColor;
                ctx.fillRect(0, 0, R, R);
                ctx.fillStyle = roofDark;
                ctx.fillRect(0, 6, R, 2);
                ctx.fillRect(0, 13, R, 3);
                ctx.fillStyle = trimColor;
                ctx.fillRect(0, 0, R, 2);
            });
            this.create(`roof_peak_${prefix}`, R, R, (ctx) => {
                // 三角の切妻屋根 (棟) - roof行の最上段に使う
                ctx.fillStyle = "#2c2c2c";
                ctx.fillRect(0, 0, R, R);
                ctx.fillStyle = roofColor;
                ctx.beginPath();
                ctx.moveTo(1, R);
                ctx.lineTo(R / 2, 1);
                ctx.lineTo(R - 1, R);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = roofDark;
                ctx.beginPath();
                ctx.moveTo(R / 2, 1);
                ctx.lineTo(R - 1, R);
                ctx.lineTo(R / 2, R);
                ctx.closePath();
                ctx.fill();
            });
            this.create(`wall_${prefix}`, R, R, (ctx) => {
                ctx.fillStyle = wallColor;
                ctx.fillRect(0, 0, R, R);
                ctx.fillStyle = wallDark;
                ctx.fillRect(0, 0, R, 1);
                ctx.fillRect(0, 7, R, 1);
                ctx.fillRect(0, R - 1, R, 1);
                ctx.fillRect(4, 1, 1, 14);
                ctx.fillRect(12, 1, 1, 14);
            });
            this.create(`window_${prefix}`, R, R, (ctx) => {
                ctx.fillStyle = wallColor;
                ctx.fillRect(0, 0, R, R);
                ctx.fillStyle = wallDark;
                ctx.fillRect(0, 0, R, 1);
                ctx.fillRect(0, R - 1, R, 1);
                ctx.fillStyle = trimColor;
                ctx.fillRect(3, 4, 10, 8);
                ctx.fillStyle = "#bfe6f7";
                ctx.fillRect(4, 5, 8, 6);
                ctx.fillStyle = "#8fcbe3";
                ctx.fillRect(4, 5, 8, 1);
                ctx.fillStyle = trimColor;
                ctx.fillRect(7, 5, 1, 6);
                ctx.fillRect(4, 8, 8, 1);
            });
        };

        drawBuildingSet("house", "#c44a4a", "#8a2626", "#d8c39a", "#b3a17e", "#8a2626");
        drawBuildingSet("shop", "#3f8fb0", "#1f5670", "#d8c39a", "#b3a17e", "#1f5670");
        drawBuildingSet("blacksmith", "#8a7160", "#4a3a2a", "#7a7a7a", "#5c5c5c", "#4a3a2a");

        this.create("cave_entrance", R, R, (ctx) => {
            ctx.fillStyle = "#4a4a4a";
            ctx.fillRect(0, 0, R, R);
            ctx.fillStyle = "#5c5c5c";
            ctx.fillRect(1, 1, 4, 3);
            ctx.fillRect(11, 2, 4, 3);
            ctx.fillStyle = "#1a1a1a";
            ctx.beginPath();
            ctx.arc(8, 10, 6, Math.PI, 0);
            ctx.fill();
            ctx.fillRect(2, 10, 12, 5);
            ctx.fillStyle = "#000000";
            ctx.beginPath();
            ctx.arc(8, 10, 4, Math.PI, 0);
            ctx.fill();
            ctx.fillRect(4, 10, 8, 4);
        });

        this.create("player_up", R, R, (ctx) => this.drawCharacter(ctx, "#4682b4", "#355a80", "up"));
        this.create("player_down", R, R, (ctx) => this.drawCharacter(ctx, "#4682b4", "#355a80", "down"));
        this.create("player_left", R, R, (ctx) => this.drawCharacter(ctx, "#4682b4", "#355a80", "left"));
        this.create("player_right", R, R, (ctx) => this.drawCharacter(ctx, "#4682b4", "#355a80", "right"));

        this.create("npc_granny", R, R, (ctx) => this.drawCharacter(ctx, "#ba55d3", "#8b3ba3", "down", { hair: "#e8e8e8" }));
        this.create("npc_merchant", R, R, (ctx) => this.drawCharacter(ctx, "#d2691e", "#a34f15", "down", { hair: "#3a2a1a" }));
        this.create("npc_blacksmith", R, R, (ctx) => this.drawCharacter(ctx, "#708090", "#525c66", "down", { hair: "#222222", apron: "#40342a" }));

        this.create("enemy_slime", R, R, (ctx) => {
            ctx.clearRect(0, 0, R, R);
            ctx.fillStyle = "#00c8c8";
            ctx.beginPath();
            ctx.arc(8, 9, 6, 0, Math.PI, true);
            ctx.lineTo(2, 12);
            ctx.lineTo(14, 12);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#6bffff";
            ctx.fillRect(5, 6, 2, 2);
            ctx.fillStyle = "#000000";
            ctx.fillRect(5, 8, 2, 2);
            ctx.fillRect(9, 8, 2, 2);
        });

        this.create("enemy_goblin", R, R, (ctx) => {
            ctx.clearRect(0, 0, R, R);
            ctx.fillStyle = "#3cb043";
            ctx.fillRect(4, 6, 8, 8);
            ctx.fillStyle = "#4caf50";
            ctx.beginPath();
            ctx.arc(8, 5, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#3cb043";
            ctx.beginPath();
            ctx.moveTo(3, 4); ctx.lineTo(1, 1); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(13, 4); ctx.lineTo(15, 1); ctx.lineTo(11, 3); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#ff0000";
            ctx.fillRect(6, 4, 1, 1);
            ctx.fillRect(9, 4, 1, 1);
            ctx.fillStyle = "#6b4a2a";
            ctx.fillRect(4, 10, 8, 3);
            ctx.fillStyle = "#8b5a2b";
            ctx.fillRect(12, 8, 2, 6);
        });

        this.create("enemy_bat", R, R, (ctx) => {
            ctx.clearRect(0, 0, R, R);
            ctx.fillStyle = "#4b0082";
            ctx.beginPath();
            ctx.moveTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(3, 9); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(8, 8); ctx.lineTo(16, 4); ctx.lineTo(13, 9); ctx.lineTo(16, 12); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.arc(8, 8, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#3a0066";
            ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(5, 2); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(10, 6); ctx.lineTo(11, 2); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#ff4500";
            ctx.fillRect(6, 7, 1, 1);
            ctx.fillRect(9, 7, 1, 1);
        });

        this.create("enemy_golem", R, R, (ctx) => {
            ctx.clearRect(0, 0, R, R);
            ctx.fillStyle = "#8d8d8d";
            ctx.fillRect(2, 4, 12, 10);
            ctx.fillStyle = "#6e6e6e";
            ctx.fillRect(2, 4, 12, 3);
            ctx.fillRect(2, 4, 3, 10);
            ctx.fillStyle = "#4a7a3f";
            ctx.fillRect(3, 11, 3, 2);
            ctx.fillStyle = "#ffcc00";
            ctx.fillRect(5, 7, 2, 2);
            ctx.fillRect(9, 7, 2, 2);
        });

        this.create("enemy_wolf", R, R, (ctx) => {
            ctx.clearRect(0, 0, R, R);
            ctx.fillStyle = "#5a5a5a";
            ctx.fillRect(2, 7, 12, 6);
            ctx.fillStyle = "#6b6b6b";
            ctx.fillRect(10, 4, 5, 5);
            ctx.fillStyle = "#5a5a5a";
            ctx.beginPath(); ctx.moveTo(10, 4); ctx.lineTo(11, 1); ctx.lineTo(12, 4); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(13, 4); ctx.lineTo(14, 1); ctx.lineTo(15, 4); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#ffff00";
            ctx.fillRect(13, 6, 1, 1);
            ctx.fillStyle = "#3f3f3f";
            ctx.fillRect(3, 12, 2, 3);
            ctx.fillRect(10, 12, 2, 3);
        });

        this.create("boss_stone_lord", R, R, (ctx) => {
            ctx.clearRect(0, 0, R, R);
            ctx.fillStyle = "#5c1a1a";
            ctx.fillRect(1, 3, 14, 12);
            ctx.fillStyle = "#7a2626";
            ctx.fillRect(1, 3, 14, 4);
            ctx.fillStyle = "#3d1010";
            ctx.fillRect(1, 3, 3, 12);
            ctx.fillRect(12, 3, 3, 12);
            ctx.fillStyle = "#ffcc00";
            ctx.fillRect(4, 7, 3, 3);
            ctx.fillRect(9, 7, 3, 3);
            ctx.fillStyle = "#1a0505";
            ctx.fillRect(5, 8, 1, 1);
            ctx.fillRect(10, 8, 1, 1);
            ctx.fillStyle = "#3d1010";
            ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(3, 0); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(16, 3); ctx.lineTo(13, 0); ctx.lineTo(12, 3); ctx.closePath(); ctx.fill();
        });
    },

    // dir: "up"/"down"/"left"/"right"
    // opts: { hair: 髪色, apron: エプロン色 (鍛冶屋用) }
    // 向きの決まり: 顔(目)が見えている側 = 進行方向。左右は「進む方向側に目・逆側に髪(後頭部)」を描く。
    drawCharacter(ctx, bodyColor, shadeColor, dir, opts = {}) {
        const R = 16;
        ctx.clearRect(0, 0, R, R);

        // 体
        ctx.fillStyle = bodyColor;
        ctx.fillRect(3, 6, 10, 10);
        ctx.fillStyle = shadeColor;
        ctx.fillRect(3, 12, 10, 4);

        // 頭
        ctx.fillStyle = "#ffdbac";
        ctx.fillRect(4, 1, 8, 6);

        // 髪 (後頭部側 = 進行方向と逆側を多めに覆う)
        const hairColor = opts.hair || "#333333";
        ctx.fillStyle = hairColor;
        ctx.fillRect(4, 0, 8, 2);
        if (dir === "down") {
            ctx.fillRect(4, 0, 2, 5);
            ctx.fillRect(10, 0, 2, 5);
        } else if (dir === "up") {
            ctx.fillRect(4, 0, 8, 6);
        } else if (dir === "left") {
            // 左向き: 後頭部(髪)は右側、顔(目)は左側
            ctx.fillRect(8, 0, 4, 6);
        } else if (dir === "right") {
            // 右向き: 後頭部(髪)は左側、顔(目)は右側
            ctx.fillRect(4, 0, 4, 6);
        }

        // エプロン (鍛冶屋用)
        if (opts.apron) {
            ctx.fillStyle = opts.apron;
            ctx.fillRect(5, 8, 6, 7);
        }

        // 目
        ctx.fillStyle = "#000000";
        if (dir === "down") {
            ctx.fillRect(5, 4, 1, 1);
            ctx.fillRect(10, 4, 1, 1);
        } else if (dir === "left") {
            ctx.fillRect(5, 4, 1, 1);
        } else if (dir === "right") {
            ctx.fillRect(10, 4, 1, 1);
        }
        // dir === "up" は後ろ姿なので目は描かない
    }
};

const MapManager = {
    mapsData: {},

    async init() {
        // maps/*.js が <script> 読み込み時点で window.MAP_DATA に全マップを登録済みなので、
        // それをそのまま使う。loadMap() は将来サーバーから動的にマップを取得したくなった時のために残してある。
        this.loadFallbackMaps();
    },

    async loadMap(id, path) {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        this.mapsData[id] = this.parseMapData(data);
    },

    loadFallbackMaps() {
        // マップデータは maps/*.js が window.MAP_DATA に登録したものを使う
        Object.keys(MAP_DATA).forEach(id => {
            this.mapsData[id] = this.parseMapData(MAP_DATA[id]);
        });
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
                completeQuest("intro");
            }
        }
    },
    {
        id: "merchant",
        name: "商店の主人",
        map: "shop",
        x: 5 * TILE_SIZE,
        y: 4 * TILE_SIZE,
        texture: "npc_merchant",
        dialogue: ["いらっしゃい。うちの店で何か買っていくかい？"],
        onTalk: () => {
            completeQuest("visit_merchant");
            ShopSystem.open();
        }
    },
    {
        id: "blacksmith",
        name: "鍛冶屋",
        map: "blacksmith",
        x: 5 * TILE_SIZE,
        y: 4 * TILE_SIZE,
        texture: "npc_blacksmith",
        dialogue: [
            "いらっしゃい。装備の強化ならまかせな。",
            "強化には金がかかるが、それだけの価値はあるぜ。最大 +5 まで鍛えられる。"
        ],
        onTalk: () => {
            completeQuest("visit_blacksmith");
            BlacksmithSystem.open();
        }
    }
];

const PlayerEntity = {
    direction: "down",
    bobbing: 0,
    bobStep: 0,
    idlePhase: Math.random() * Math.PI * 2,
    moveSpeed: 3.2,
    needsEncounterCheck: false,

    update() {
        if (isUIBlocking()) return;
        
        const p = GameState.player;
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        
        if (Math.abs(dx) > 0) {
            p.x += Math.sign(dx) * Math.min(this.moveSpeed, Math.abs(dx));
        }
        if (Math.abs(dy) > 0) {
            p.y += Math.sign(dy) * Math.min(this.moveSpeed, Math.abs(dy));
        }

        const isMoving = p.x !== p.targetX || p.y !== p.targetY;

        if (isMoving) {
            this.bobStep += 0.4;
            this.bobbing = Math.sin(this.bobStep) * 2;
        } else {
            this.bobbing = getIdleBob(this.idlePhase);
            if (this.needsEncounterCheck) {
                this.needsEncounterCheck = false;
                this.checkEncounter();
            }
        }
    },

    move(dir) {
        if (isUIBlocking()) return;
        
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
            this.needsEncounterCheck = true;

            if (tile.portal) {
                setTimeout(() => {
                    transitionArea(tile.portal);
                }, 150);
            }
        }
    },
    
    checkEncounter() {
        const p = GameState.player;
        const targetEnemyIndex = GameState.spawnedEnemies.findIndex(e => e.map === GameState.currentMap && Math.abs(e.x - p.x) < 5 && Math.abs(e.y - p.y) < 5);
        if (targetEnemyIndex !== -1) {
            BattleSystem.start(targetEnemyIndex);
        }
    }
};

// メニュー・ショップ・鍛冶場・会話中・戦闘中など、移動を止めるべき状態かどうかを判定する
// タッチ操作可能な端末かどうかを判定する (スマホ/タブレット向けに仮想パッドを自動表示するため)
function isTouchDevice() {
    return ("ontouchstart" in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
}

// iPhoneかどうかを判定し、<html>にクラスを付与する。
// (iOS SafariはFullscreen API/画面回転ロックAPIが使えないため、CSSでの疑似回転で横画面化する)
function applyIphoneLandscapeLock() {
    const isIphone = /iPhone/i.test(navigator.userAgent);
    document.documentElement.classList.toggle("is-iphone", isIphone);
}

function isUIBlocking() {
    if (GameState.isBattling || DialogueSystem.isActive) return true;
    const blockingIds = ["menu-window", "shop-window", "blacksmith-window"];
    return blockingIds.some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains("hidden");
    });
}

function transitionArea(portalTarget) {
    const [targetMap, coords] = portalTarget.split(":");
    let tx = null, ty = null;
    if (coords) {
        const [c, r] = coords.split(",").map(Number);
        tx = c * TILE_SIZE;
        ty = r * TILE_SIZE;
    }

    GameState.currentMap = targetMap;

    if (targetMap === "inside") {
        GameState.player.x = GameState.player.targetX = tx ?? 5 * TILE_SIZE;
        GameState.player.y = GameState.player.targetY = ty ?? 7 * TILE_SIZE;
        addLog("家の中に入った。");
    } else if (targetMap === "shop") {
        GameState.player.x = GameState.player.targetX = tx ?? 5 * TILE_SIZE;
        GameState.player.y = GameState.player.targetY = ty ?? 7 * TILE_SIZE;
        addLog("商店に入った。");
    } else if (targetMap === "blacksmith") {
        GameState.player.x = GameState.player.targetX = tx ?? 5 * TILE_SIZE;
        GameState.player.y = GameState.player.targetY = ty ?? 7 * TILE_SIZE;
        addLog("鍛冶場に入った。");
    } else if (targetMap === "dungeon") {
        GameState.player.x = GameState.player.targetX = tx ?? 5 * TILE_SIZE;
        GameState.player.y = GameState.player.targetY = ty ?? 11 * TILE_SIZE;
        addLog("ダンジョンに足を踏み入れた...何かの気配がする。");
        ensureDungeonBoss();
    } else {
        GameState.currentMap = "outside";
        GameState.player.x = GameState.player.targetX = tx ?? 12 * TILE_SIZE;
        GameState.player.y = GameState.player.targetY = ty ?? 7 * TILE_SIZE;
        addLog("外に出て、澄んだ空気を吸い込んだ。");
    }
    SaveSystem.save();
}

const InputHandler = {
    keysPressed: {},

    init() {
        window.addEventListener("keydown", (e) => {
            if (document.activeElement.id === "debug-input") return;
            this.keysPressed[e.code] = true;
            this.handleActionKeys(e.code);
            this.checkSecretCombo();
        });
        window.addEventListener("keyup", (e) => {
            if (document.activeElement.id === "debug-input") return;
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
            } else if (!isUIBlocking()) {
                interact();
            }
        }
        if (code === "KeyM" || code === "Escape") {
            if (!GameState.isBattling) {
                UIManager.toggleMenu();
            }
        }
    },

    // A, S, R, I を同時押しすると隠しユニークスキル「console」を入手し、デバッグコンソールが使えるようになる
    checkSecretCombo() {
        const kp = this.keysPressed;
        if (kp["KeyA"] && kp["KeyS"] && kp["KeyR"] && kp["KeyI"]) {
            unlockUniqueSkill("console");
        }
    },

    update() {
        if (isUIBlocking()) return;
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

    appendLog(msg) {
        document.getElementById("battle-message").innerHTML += msg;
    },

    updateUI() {
        const p = GameState.player;
        document.getElementById("battle-enemy-name").innerText = this.enemyData.name;
        const enemyHpPercent = Math.max(0, (this.enemyData.hp / this.enemyData.maxHp) * 100);
        document.getElementById("battle-enemy-hp-fill").style.width = enemyHpPercent + "%";
        
        const displayHp = Math.max(0, p.hp);
        document.getElementById("b-hp").innerText = displayHp;
        document.getElementById("b-maxhp").innerText = p.maxHp;
        document.getElementById("b-mp").innerText = p.mp;
        document.getElementById("b-maxmp").innerText = p.maxMp;

        const playerHpPercent = Math.max(0, (displayHp / p.maxHp) * 100);
        const playerMpPercent = Math.max(0, (p.mp / p.maxMp) * 100);
        document.getElementById("battle-player-hp-fill").style.width = playerHpPercent + "%";
        document.getElementById("battle-player-mp-fill").style.width = playerMpPercent + "%";
        
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
        const elementMultiplier = getElementMultiplier("physical", this.enemyData);
        const damage = Math.max(1, Math.floor((p.str - this.enemyData.vit) * elementMultiplier));
        this.enemyData.hp -= damage;
        this.log(`あなたの攻撃！ ${damage} のダメージを与えた。${getElementFlavorText(elementMultiplier)}`);
        this.updateUI();
        
        setTimeout(() => this.checkWinOrEnemyTurn(), 1500);
    },

    showSkills() {
        if (!this.isPlayerTurn) return;
        const sub = document.getElementById("battle-sub-menu");
        sub.innerHTML = "";
        
        GameState.player.skills.forEach(skillId => {
            const skill = SKILL_DATABASE[skillId];
            if (skill && (skill.type === "attack" || skill.type === "heal")) {
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
        
        const slv = p.skillLevels[skillId] || 1;
        if (skill.type === "attack") {
            const scaledPower = skill.power + (slv - 1) * 0.5;
            const elementMultiplier = getElementMultiplier(skill.element, this.enemyData);
            const damage = Math.max(1, Math.floor(p.str * scaledPower * elementMultiplier) - this.enemyData.vit);
            this.enemyData.hp -= damage;
            this.log(`${skill.name}！ ${damage} のダメージを与えた！${getElementFlavorText(elementMultiplier)}`);
        } else if (skill.type === "heal") {
            const scaledHeal = skill.power + (slv - 1) * 20;
            p.hp = Math.min(p.maxHp, p.hp + scaledHeal);
            this.log(`${skill.name}！ HPが ${scaledHeal} 回復した。`);
        }
        
        this.updateUI();
        setTimeout(() => this.checkWinOrEnemyTurn(), 1500);
    },

    showItems() {
        if (!this.isPlayerTurn) return;
        const sub = document.getElementById("battle-sub-menu");
        sub.innerHTML = "";
        
        const uniqueItems = [...new Set(GameState.player.inventory.filter(id => {
            const item = ITEM_DATABASE[id];
            return item && item.type === "consumable";
        }))];
        if (uniqueItems.length === 0) {
            sub.innerHTML = "<div style='padding:10px;'>使えるアイテムを持っていない</div>";
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

        this.log(useConsumable(itemId));

        this.updateUI();
        setTimeout(() => this.checkWinOrEnemyTurn(), 1500);
    },

    run() {
        if (!this.isPlayerTurn) return;
        document.getElementById("battle-sub-menu").classList.add("hidden");
        this.isPlayerTurn = false;
        
        const escapeChance = GameState.player.skills.includes("lucky_charm") ? 1.0 : 0.7;
        if (Math.random() < escapeChance) {
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
        GameState.player.hp = Math.max(0, GameState.player.hp - damage);
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
        const expMultiplier = 1.0 + getPassiveSpecialValue("expBoost");
        const goldMultiplier = 1.0 + getPassiveSpecialValue("goldBoost");

        const finalExp = Math.floor(this.enemyData.rewardExp * expMultiplier);
        const finalGold = Math.floor(this.enemyData.rewardGold * goldMultiplier);

        this.log(`経験値を ${finalExp}、お金を ${finalGold}G 獲得した！`);
        GameState.player.gold += finalGold;

        addExp(finalExp);

        if (this.enemyData.isBoss) {
            GameState.dungeonBossDefeated = true;
            GameState.player.inventory.push(createEquipmentInstance("adamantite_sword", 2));
            this.log("ボスを打ち破った！ 「アダマンタイトの剣 +2」を手に入れた！");
            if (GameState.quests.dungeon_boss.state === "active") {
                completeQuest("dungeon_boss");
            }
        }

        if (this.enemyData.name === "水辺のスライム" && GameState.quests.extermination.state === "active") {
            progressQuest("extermination");
            if (GameState.quests.extermination.state === "completed") {
                unlockUniqueSkill("lucky_charm");
            }
        }

        if (this.enemyData.name === "野生のウルフ" && GameState.quests.hunt_wolves.state === "active") {
            progressQuest("hunt_wolves");
        }
        
        setTimeout(() => this.endBattle(true), 2500);
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

// ダンジョンに入った時、まだ倒されていなければボスを配置する
function ensureDungeonBoss() {
    if (GameState.dungeonBossDefeated) return;
    if (GameState.spawnedEnemies.some(e => e.isBoss)) return;

    const boss = BOSS_DATABASE.dungeon_lord;
    GameState.spawnedEnemies.push({
        name: boss.name,
        map: "dungeon",
        x: boss.x,
        y: boss.y,
        hp: boss.hp,
        maxHp: boss.hp,
        str: boss.str,
        vit: boss.vit,
        rewardExp: boss.rewardExp,
        rewardGold: boss.rewardGold,
        texture: boss.texture,
        weakness: boss.weakness,
        resist: boss.resist,
        isBoss: true
    });
}

const EnemySpawner = {
    lastSpawnTime: 0,
    spawnInterval: 5000,

    update(timestamp) {
        if ((GameState.currentMap !== "outside" && GameState.currentMap !== "dungeon") || GameState.isBattling) return;

        if (!this.lastSpawnTime) this.lastSpawnTime = timestamp;
        if (timestamp - this.lastSpawnTime > this.spawnInterval) {
            this.lastSpawnTime = timestamp;
            if (GameState.spawnedEnemies.filter(e => e.map === GameState.currentMap).length < 4) {
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
        const currentMap = GameState.currentMap;

        const candidates = ENEMY_DATABASE.filter(e => {
            if (GameState.player.level < e.minLevel) return false;
            if (e.dungeonOnly) return currentMap === "dungeon";
            return true;
        });
        const template = candidates[Math.floor(Math.random() * candidates.length)];
        if (!template) return;

        while (attempts < 100) {
            const r = Math.floor(Math.random() * (maxRows - 2)) + 1;
            const c = Math.floor(Math.random() * (maxCols - 2)) + 1;
            
            if (grid[r][c].passable && !this.isEnemyAt(c * TILE_SIZE, r * TILE_SIZE)) {
                GameState.spawnedEnemies.push({
                    name: template.name,
                    map: currentMap,
                    x: c * TILE_SIZE,
                    y: r * TILE_SIZE,
                    hp: template.hp,
                    maxHp: template.hp,
                    str: template.str,
                    vit: template.vit,
                    rewardExp: template.rewardExp,
                    rewardGold: template.rewardGold,
                    texture: template.texture,
                    weakness: template.weakness,
                    resist: template.resist
                });
                break;
            }
            attempts++;
        }
    },

    isEnemyAt(x, y) {
        return GameState.spawnedEnemies.some(e => e.map === GameState.currentMap && e.x === x && e.y === y);
    }
};

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
                <span>${getItemIcon(item)} ${item.name} (${item.cost}G)</span>
                <button onclick="ShopSystem.buy('${item.id}')">購入</button>
            `;
            buyList.appendChild(row);
        });

        const sellList = document.getElementById("shop-sell-list");
        sellList.innerHTML = "";

        GameState.player.inventory.forEach((entry, idx) => {
            const itemId = typeof entry === "string" ? entry : entry.itemId;
            const item = ITEM_DATABASE[itemId];
            if (item) {
                const level = typeof entry === "object" ? (entry.level || 0) : 0;
                const levelTag = level > 0 ? ` +${level}` : "";
                const sellVal = level > 0 ? Math.round(item.sellValue * (1 + ENHANCE_BONUS_PER_LEVEL * level)) : item.sellValue;
                const row = document.createElement("div");
                row.className = "item-row";
                row.innerHTML = `
                    <span>${getItemIcon(item)} ${item.name}${levelTag} (+${sellVal}G)</span>
                    <button onclick="ShopSystem.sell(${idx})">売却</button>
                `;
                sellList.appendChild(row);
            }
        });
    },

    buy(itemId) {
        const item = ITEM_DATABASE[itemId];
        const p = GameState.player;
        if (!item) return;
        if (p.gold >= item.cost) {
            p.gold -= item.cost;
            p.inventory.push(item.type === "equipment" ? createEquipmentInstance(itemId, 0) : itemId);
            addLog(`${item.name}を購入した。`);
            this.render();
            UIManager.updateUI();
            SaveSystem.save();
        } else {
            addLog("お金が足りません！");
        }
    },

    sell(index) {
        const p = GameState.player;
        const entry = p.inventory[index];
        const itemId = typeof entry === "string" ? entry : entry.itemId;
        const item = ITEM_DATABASE[itemId];
        if (item) {
            const level = typeof entry === "object" ? (entry.level || 0) : 0;
            const sellVal = level > 0 ? Math.round(item.sellValue * (1 + ENHANCE_BONUS_PER_LEVEL * level)) : item.sellValue;
            p.gold += sellVal;
            p.inventory.splice(index, 1);
            addLog(`${item.name}を売却した。`);
            this.render();
            UIManager.updateUI();
            SaveSystem.save();
        }
    }
};
window.ShopSystem = ShopSystem;

// 消費アイテムの効果を ITEM_DATABASE の定義に基づいて適用し、ログメッセージを返す。
// バトル中/メニューの両方の「使う」処理から呼ばれる共通ロジック。
function useConsumable(itemId) {
    const item = ITEM_DATABASE[itemId];
    const p = GameState.player;

    if (!item || item.type !== "consumable" || !item.effect) {
        return `${item ? item.name : "アイテム"}を使った！ ...しかし何も起こらなかった。`;
    }

    const { stat, value } = item.effect;
    if (stat === "hp") {
        const before = p.hp;
        p.hp = value === "full" ? p.maxHp : Math.min(p.maxHp, p.hp + value);
        return `${item.name}を使った！ HPが${p.hp - before}回復した。`;
    } else if (stat === "mp") {
        const before = p.mp;
        p.mp = value === "full" ? p.maxMp : Math.min(p.maxMp, p.mp + value);
        return `${item.name}を使った！ MPが${p.mp - before}回復した。`;
    }

    return `${item.name}を使った！ ...しかし何も起こらなかった。`;
}

const EquipmentSystem = {
    // uid で指定したインスタンスを所持品から装備スロットへ移す。既に同スロットに何か装備していれば所持品へ戻す。
    equip(uid) {
        const p = GameState.player;
        const idx = p.inventory.findIndex(entry => typeof entry === "object" && entry.uid === uid);
        if (idx === -1) return;

        const instance = p.inventory[idx];
        const item = ITEM_DATABASE[instance.itemId];
        if (!item || item.type !== "equipment") return;

        const currentEquipped = p.equipment[item.slot];
        p.inventory.splice(idx, 1);
        if (currentEquipped) {
            p.inventory.push(currentEquipped);
        }
        p.equipment[item.slot] = instance;

        updateEffectiveStats();
        addLog(`${item.name}${instance.level > 0 ? ` +${instance.level}` : ""}を装備した。`);
        UIManager.updateUI();
        SaveSystem.save();
    },

    // 指定スロットの装備を外して所持品に戻す
    unequip(slot) {
        const p = GameState.player;
        const instance = p.equipment[slot];
        if (!instance) return;
        const item = ITEM_DATABASE[instance.itemId];

        p.equipment[slot] = null;
        p.inventory.push(instance);

        updateEffectiveStats();
        addLog(`${item ? item.name : "装備"}を外した。`);
        UIManager.updateUI();
        SaveSystem.save();
    }
};
window.EquipmentSystem = EquipmentSystem;

// 鍛冶場: 所持品/装備中の装備を強化する (レベルは最大 MAX_ENHANCE_LEVEL、Gを消費)
const BlacksmithSystem = {
    isOpen: false,

    open() {
        this.isOpen = true;
        document.getElementById("blacksmith-window").classList.remove("hidden");
        this.render();
    },

    close() {
        this.isOpen = false;
        document.getElementById("blacksmith-window").classList.add("hidden");
    },

    // 強化対象の一覧を作る。ref は "equip:スロット名" または "inv:uid" で対象を一意に特定する。
    getEnhanceableList() {
        const p = GameState.player;
        const list = [];
        SLOT_ORDER.forEach(slot => {
            const instance = p.equipment[slot];
            if (instance) list.push({ ref: `equip:${slot}`, instance, label: `${SLOT_LABELS[slot]}（装備中）` });
        });
        p.inventory.forEach(entry => {
            if (typeof entry === "object" && entry.itemId && ITEM_DATABASE[entry.itemId] && ITEM_DATABASE[entry.itemId].type === "equipment") {
                list.push({ ref: `inv:${entry.uid}`, instance: entry, label: "所持品" });
            }
        });
        return list;
    },

    render() {
        const listDiv = document.getElementById("blacksmith-list");
        listDiv.innerHTML = "";
        const items = this.getEnhanceableList();

        if (items.length === 0) {
            listDiv.innerHTML = "<div style='padding:10px;'>強化できる装備を持っていません。</div>";
            return;
        }

        items.forEach(({ ref, instance, label }) => {
            const item = ITEM_DATABASE[instance.itemId];
            if (!item) return;
            const level = instance.level || 0;
            const maxed = level >= MAX_ENHANCE_LEVEL;
            const cost = getEnhanceCost(item, level);
            const row = document.createElement("div");
            row.className = "item-row";
            row.innerHTML = `
                <span><strong>${getItemIcon(item)} ${item.name} +${level}</strong> [${label}]<br>
                <small>${maxed ? "最大強化済み" : `次のLvへ: ${cost}G`}</small></span>
                <button ${maxed ? "disabled" : ""} onclick="BlacksmithSystem.enhance('${ref}')">${maxed ? "MAX" : "強化"}</button>
            `;
            listDiv.appendChild(row);
        });
    },

    enhance(ref) {
        const p = GameState.player;
        let instance = null;
        if (ref.startsWith("equip:")) {
            instance = p.equipment[ref.slice(6)];
        } else if (ref.startsWith("inv:")) {
            const uid = ref.slice(4);
            instance = p.inventory.find(e => typeof e === "object" && e.uid === uid);
        }
        if (!instance) return;

        const item = ITEM_DATABASE[instance.itemId];
        if (!item) return;
        if (instance.level >= MAX_ENHANCE_LEVEL) {
            addLog("これ以上は強化できません。");
            return;
        }

        const cost = getEnhanceCost(item, instance.level);
        if (p.gold < cost) {
            addLog("お金が足りません！");
            return;
        }

        p.gold -= cost;
        instance.level += 1;
        updateEffectiveStats();
        addLog(`${item.name} を +${instance.level} に強化した！ (${cost}G)`);

        this.render();
        UIManager.updateUI();
        SaveSystem.save();
    }
};
window.BlacksmithSystem = BlacksmithSystem;

// 旧バージョンのセーブデータ (手1枠・文字列ベースの装備) を新形式へ変換する
function migrateEquipmentData() {
    const p = GameState.player;

    const legacyHand = p.equipment && p.equipment.hand;
    const freshEquipment = { head: null, body: null, feet: null, neck: null, leftHand: null, rightHand: null };
    p.equipment = { ...freshEquipment, ...(p.equipment || {}) };
    delete p.equipment.hand;

    if (legacyHand) {
        p.inventory.push(legacyHand);
    }

    p.inventory = p.inventory.map(entry => normalizeItemEntry(entry)).filter(Boolean);
    SLOT_ORDER.forEach(slot => {
        if (p.equipment[slot]) {
            p.equipment[slot] = normalizeItemEntry(p.equipment[slot]);
        }
    });
}

// 文字列ID/インスタンスの両対応で所持品エントリを正規化する
function normalizeItemEntry(entry) {
    if (typeof entry === "string") {
        const item = ITEM_DATABASE[entry];
        if (item && item.type === "equipment") {
            return createEquipmentInstance(entry, 0);
        }
        return item ? entry : null;
    }
    if (entry && typeof entry === "object" && entry.itemId) {
        if (!ITEM_DATABASE[entry.itemId]) return null;
        if (entry.uid === undefined) entry.uid = generateItemUid(entry.itemId);
        if (entry.level === undefined) entry.level = 0;
        entry.level = Math.max(0, Math.min(MAX_ENHANCE_LEVEL, entry.level));
        return entry;
    }
    return null;
}

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
                if (GameState.player.sp === undefined) GameState.player.sp = 0;
                if (!GameState.player.name) GameState.player.name = "Player";
                if (!GameState.player.skillLevels) {
                    GameState.player.skillLevels = {};
                    GameState.player.skills.forEach(s => GameState.player.skillLevels[s] = 1);
                }
                if (!GameState.player.baseStats) {
                    GameState.player.baseStats = { maxHp: 100, maxMp: 30, str: 10, agi: 10, vit: 10 };
                }
                migrateEquipmentData();
                if (GameState.dungeonBossDefeated === undefined) GameState.dungeonBossDefeated = false;
                Object.keys(QUEST_DATABASE).forEach(qid => {
                    if (!GameState.quests[qid]) {
                        GameState.quests[qid] = JSON.parse(JSON.stringify(QUEST_DATABASE[qid]));
                    }
                });

                recalculateStats();

                GameState.player.targetX = GameState.player.x;
                GameState.player.targetY = GameState.player.y;
                GameState.isBattling = false;
                addLog("セーブデータをロードしました。");
            } catch (e) {
                addLog("セーブデータの破損を検知しました。再作成します。");
                this.reset();
            }
        } else {
            // 新規プレイ時、タッチ操作可能な端末なら仮想パッドを最初から表示しておく
            if (isTouchDevice()) {
                GameState.settings.showTouch = true;
            }
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
        document.getElementById("blacksmith-close-btn").addEventListener("click", () => BlacksmithSystem.close());

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

        document.getElementById("player-name-save-btn").addEventListener("click", () => {
            const input = document.getElementById("player-name-input");
            const newName = input.value.trim();
            if (!newName) {
                addLog("名前を入力してください。");
                return;
            }
            GameState.player.name = newName.slice(0, 12);
            addLog(`名前を「${GameState.player.name}」に変更した。`);
            this.updateUI();
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

    allocateSP(skillId) {
        const p = GameState.player;
        const skill = SKILL_DATABASE[skillId];
        if (!skill) return;
        
        const slv = p.skillLevels[skillId] || 1;
        const requiredSp = skill.baseSpCost + (slv - 1) * skill.spCostGrowth;
        
        if (p.sp >= requiredSp) {
            p.sp -= requiredSp;
            p.skillLevels[skillId] = slv + 1;
            this.updateUI();
            SaveSystem.save();
        }
    },

    updateUI() {
        const p = GameState.player;

        const nameElem = document.getElementById("main-player-name");
        if (nameElem) nameElem.innerText = p.name;

        const nameInput = document.getElementById("player-name-input");
        if (nameInput && document.activeElement !== nameInput) {
            nameInput.value = p.name;
        }
        
        const goldValElem = document.getElementById("main-gold-val");
        if (goldValElem) goldValElem.innerText = p.gold;

        const nextExp = p.level * 100;
        document.getElementById("stat-lv").innerText = p.level;
        document.getElementById("stat-exp").innerText = p.exp;
        document.getElementById("stat-next-exp").innerText = nextExp;
        
        document.getElementById("stat-sp").innerText = p.sp;

        const statWithBonus = (elemId, statKey, total) => {
            const bonus = getEquipmentBonus(statKey) + getSkillStatBonus(statKey);
            document.getElementById(elemId).innerText = bonus > 0 ? `${total} (+${bonus})` : total;
        };
        statWithBonus("stat-hp", "maxHp", p.maxHp);
        statWithBonus("stat-mp", "maxMp", p.maxMp);
        statWithBonus("stat-str", "str", p.str);
        statWithBonus("stat-agi", "agi", p.agi);
        statWithBonus("stat-vit", "vit", p.vit);

        const debugPanel = document.getElementById("debug-panel");
        if (debugPanel) debugPanel.classList.toggle("hidden", !p.skills.includes("console"));

        const equipListDiv = document.getElementById("equipment-list");
        if (equipListDiv) {
            equipListDiv.innerHTML = "";
            SLOT_ORDER.forEach(slot => {
                const instance = p.equipment[slot];
                const item = instance ? ITEM_DATABASE[instance.itemId] : null;
                const row = document.createElement("div");
                row.className = "equip-row";

                if (item) {
                    const level = instance.level || 0;
                    const levelTag = level > 0 ? ` +${level}` : "";
                    const statsText = Object.entries(item.stats || {})
                        .map(([k, v]) => `${STAT_LABELS[k] || k} +${Math.round(v * (1 + ENHANCE_BONUS_PER_LEVEL * level))}`).join(" / ");
                    row.innerHTML = `
                        <div>
                            <strong>${SLOT_LABELS[slot]}:</strong> ${item.name}${levelTag}
                            <br><small>${statsText}${item.specialEffect ? "（特殊効果あり）" : ""}</small>
                        </div>
                        <button onclick="EquipmentSystem.unequip('${slot}')">外す</button>
                    `;
                } else {
                    row.innerHTML = `
                        <div><strong>${SLOT_LABELS[slot]}:</strong> <span style="color:#666;">(なし)</span></div>
                    `;
                }
                equipListDiv.appendChild(row);
            });
        }

        const skillsListDiv = document.getElementById("stat-skills-list");
        skillsListDiv.innerHTML = "";
        p.skills.forEach(skillId => {
            const skill = SKILL_DATABASE[skillId];
            if (!skill) return;
            const row = document.createElement("div");
            row.className = "skill-row";

            if (skill.type === "unique") {
                row.innerHTML = `
                    <div style="flex:1;">
                        <strong>${skill.name}</strong><br>
                        <small>ユニーク（レベルなし） / ${skill.description}</small>
                    </div>
                `;
            } else {
                const slv = p.skillLevels[skillId] || 1;
                const requiredSp = skill.baseSpCost + (slv - 1) * skill.spCostGrowth;
                const canUpgrade = p.sp >= requiredSp;
                const mpText = (skill.type === "attack" || skill.type === "heal") ? `MP: ${skill.mpCost}` : "パッシブ";

                row.innerHTML = `
                    <div style="flex:1;">
                        <strong>${skill.name} (Lv.${slv})</strong><br>
                        <small>${mpText} / ${skill.description}</small>
                    </div>
                    <button class="sp-btn" ${!canUpgrade ? "disabled" : ""} onclick="UIManager.allocateSP('${skillId}')">強化 (SP:${requiredSp})</button>
                `;
            }
            skillsListDiv.appendChild(row);
        });

        const invList = document.getElementById("inventory-list");
        invList.innerHTML = "";
        p.inventory.forEach((entry, idx) => {
            const itemId = typeof entry === "string" ? entry : entry.itemId;
            const item = ITEM_DATABASE[itemId];
            if (!item) return;
            const row = document.createElement("div");
            row.className = "item-row";

            if (item.type === "equipment") {
                const level = entry.level || 0;
                const levelTag = level > 0 ? ` +${level}` : "";
                const statsText = Object.entries(item.stats || {})
                    .map(([k, v]) => `${STAT_LABELS[k] || k} +${Math.round(v * (1 + ENHANCE_BONUS_PER_LEVEL * level))}`).join(" / ");
                row.innerHTML = `
                    <span><strong>${getItemIcon(item)} ${item.name}${levelTag}</strong> [${SLOT_LABELS[item.slot]}] - ${statsText}</span>
                    <button onclick="EquipmentSystem.equip('${entry.uid}')">装備</button>
                `;
            } else if (item.type === "skill_book") {
                const learned = p.skills.includes(item.grantsSkill);
                row.innerHTML = `
                    <span><strong>${getItemIcon(item)} ${item.name}</strong> - ${item.description}</span>
                    <button ${learned ? "disabled" : ""} onclick="learnSkill(${idx})">${learned ? "習得済み" : "習得"}</button>
                `;
            } else {
                row.innerHTML = `
                    <span><strong>${getItemIcon(item)} ${item.name}</strong> - ${item.description}</span>
                    <button onclick="useItem(${idx})">使う</button>
                `;
            }
            invList.appendChild(row);
        });

        const questListDiv = document.getElementById("quest-list");
        questListDiv.innerHTML = "";
        Object.values(GameState.quests).forEach(q => {
            if (q.state === "locked") return; // 未解放のクエストは表示しない

            const row = document.createElement("div");
            row.className = "quest-row";
            
            let statusText = "未受注";
            if (q.state === "active") {
                statusText = q.targetCount ? `進行中 (${q.currentCount}/${q.targetCount})` : "進行中";
            } else if (q.state === "completed") {
                statusText = "達成！(未受取)";
            } else if (q.state === "claimed") {
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
                actBtn.onclick = () => startQuest(q.id);
                row.appendChild(actBtn);
            } else if (q.state === "completed") {
                const claimBtn = document.createElement("button");
                claimBtn.innerText = "報酬を受け取る";
                claimBtn.onclick = () => claimQuestReward(q.id);
                row.appendChild(claimBtn);
            }

            questListDiv.appendChild(row);
        });
    }
};
window.UIManager = UIManager;

window.useItem = function(index) {
    const p = GameState.player;
    const itemId = p.inventory[index];
    const item = ITEM_DATABASE[itemId];

    if (!item || item.type !== "consumable") {
        addLog("ここでは使用できません。");
        return;
    }

    p.inventory.splice(index, 1);
    addLog(useConsumable(itemId));
    UIManager.updateUI();
    SaveSystem.save();
};

window.learnSkill = function(index) {
    const p = GameState.player;
    const entry = p.inventory[index];
    const itemId = typeof entry === "string" ? entry : null;
    const item = itemId ? ITEM_DATABASE[itemId] : null;

    if (!item || item.type !== "skill_book") {
        addLog("それは読める本ではありません。");
        return;
    }

    const skillId = item.grantsSkill;
    const skill = SKILL_DATABASE[skillId];
    if (!skill) return;

    if (p.skills.includes(skillId)) {
        addLog(`${skill.name} はすでに習得しています。`);
        return;
    }

    p.inventory.splice(index, 1);
    p.skills.push(skillId);
    p.skillLevels[skillId] = 1;
    addLog(`スキルブックを読んで「${skill.name}」を習得した！`);
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
                const cmd = input.value;
                input.value = "";
                this.execute(cmd, output);
            }
        });
    },

    execute(cmdText, outputDiv) {
        const args = cmdText.trim().split(/\s+/);
        if (args.length === 0 || args[0] === "") return;
        
        const baseCmd = args[0].toLowerCase();
        let logText = `> ${cmdText}\n`;
        const p = GameState.player;

        const validStats = ["hp", "maxHp", "mp", "maxMp", "str", "agi", "vit", "level"];
        const allClearable = [...validStats];

        if (baseCmd === "help") {
            logText += "【コマンド一覧】\n";
            logText += "help : この一覧を表示\n";
            logText += "init : セーブデータを初期化して再起動\n";
            logText += "exp [値 or clear] : 経験値を指定量追加、clearで0にリセット (例: exp 100 / exp clear)\n";
            logText += "sp [値 or clear] : SPを指定量追加、clearで0にリセット (例: sp 5 / sp clear)\n";
            logText += "gold [値 or clear] : ゴールドを指定量追加、clearで0にリセット (例: gold 500 / gold clear)\n";
            logText += "stat [項目] [値] : ステータスを直接書き換え (例: stat hp 100)\n";
            logText += "                   項目: hp, mp, str, agi, vit, level\n";
            logText += "[項目] clear : 指定した項目を 0 にする (例: hp clear)\n";
            logText += "skill [id] : スキルを強制習得 (例: skill exp_boost)\n";
            logText += "item [itemId] [強化Lv] : アイテムを入手 (装備品は強化Lvを指定可, 例: item iron_sword 3)\n";
            logText += "equip [itemId] [強化Lv] : 装備品を強制入手して装備 (例: equip iron_sword 3)\n";
            logText += "unequip [head/body/leftHand/rightHand/neck/feet] : 指定スロットの装備を外す\n";
            logText += "warp [outside/inside/shop/blacksmith/dungeon] : 指定マップへワープ\n";
            logText += "npc [id] : 指定NPCを現在地に召喚\n";
            logText += "itemlist : 全アイテムの ID と名前の対応表を表示\n";
            logText += "skilllist : 全スキルの ID と名前の対応表を表示\n";
        } else if (baseCmd === "init") {
            logText += "セーブデータを初期化します...";
            outputDiv.innerText += `\n${logText}`;
            SaveSystem.reset();
            return;
        } else if (allClearable.includes(baseCmd) && args[1] === "clear") {
            p[baseCmd] = 0;
            if (baseCmd === "level") p.level = 0; 
            logText += `${baseCmd.toUpperCase()} を 0 にリセットしました。`;
        } else if (baseCmd === "exp") {
            if (args[1] === "clear") {
                p.exp = 0;
                logText += "経験値を 0 にリセットしました。";
            } else {
                const val = parseInt(args[1]);
                if (isNaN(val) || val <= 0) logText += "エラー: 正しい数値を入力するか、'clear' を指定してください。";
                else { addExp(val); logText += `経験値を ${val} 獲得しました。`; }
            }
        } else if (baseCmd === "sp") {
            if (args[1] === "clear") {
                p.sp = 0;
                logText += "SP を 0 にリセットしました。";
            } else {
                const val = parseInt(args[1]);
                if (isNaN(val) || val <= 0) logText += "エラー: 正しい数値を入力するか、'clear' を指定してください。";
                else { p.sp += val; logText += `SP を ${val} 追加しました。`; }
            }
        } else if (baseCmd === "gold") {
            if (args[1] === "clear") {
                p.gold = 0;
                logText += "ゴールドを 0 にリセットしました。";
            } else {
                const val = parseInt(args[1]);
                if (isNaN(val) || val <= 0) logText += "エラー: 正しい数値を入力するか、'clear' を指定してください。";
                else { p.gold += val; logText += `ゴールドを ${val} 追加しました。`; }
            }
        } else if (baseCmd === "itemlist") {
            logText += "【アイテム一覧 (ID : 名前)】\n";
            Object.values(ITEM_DATABASE).forEach(item => {
                logText += `${item.id} : ${item.name}\n`;
            });
        } else if (baseCmd === "skilllist") {
            logText += "【スキル一覧 (ID : 名前)】\n";
            Object.values(SKILL_DATABASE).forEach(skill => {
                logText += `${skill.id} : ${skill.name}\n`;
            });
        } else if (baseCmd === "stat") {
            const statName = args[1];
            if (!statName) {
                logText += "エラー: stat [ステータス名] [数値] の形式で入力してください。";
            } else if (!validStats.includes(statName)) {
                logText += `エラー: 変更可能なステータスは ${validStats.join(", ")} です。`;
            } else if (args[2] === "clear") {
                p[statName] = 0;
                logText += `${statName.toUpperCase()} を 0 にリセットしました。`;
            } else {
                const val = parseInt(args[2]);
                if (isNaN(val)) {
                    logText += "エラー: 正しい数値を入力するか、'clear' を指定してください。";
                } else {
                    p[statName] = val;
                    if (statName === "level") {
                        p.exp = 0;
                        recalculateStats();
                        p.hp = p.maxHp;
                        p.mp = p.maxMp;
                        logText += `レベルを ${val} に変更しました。(ステータス再計算・全回復)`;
                    } else {
                        logText += `${statName.toUpperCase()} を ${val} に変更しました。(最大値制限無視)`;
                    }
                }
            }
        } else if (baseCmd === "skill") {
            const skillId = args[1];
            if (SKILL_DATABASE[skillId] && !p.skills.includes(skillId)) {
                p.skills.push(skillId);
                p.skillLevels[skillId] = 1;
                logText += `スキル [${skillId}] を強制習得しました。`;
            } else logText += "エラー: スキルIDが無効か、既に習得済みです。";
        } else if (baseCmd === "item") {
            const itemId = args[1];
            const item = ITEM_DATABASE[itemId];
            if (!item) {
                logText += "エラー: 存在しないアイテムIDです。";
            } else if (item.type === "equipment") {
                let level = parseInt(args[2]);
                if (isNaN(level)) level = 0;
                level = Math.max(0, Math.min(MAX_ENHANCE_LEVEL, level));
                p.inventory.push(createEquipmentInstance(itemId, level));
                logText += `${item.name} (+${level}) を入手しました。`;
            } else {
                p.inventory.push(itemId);
                logText += `${item.name} を入手しました。`;
            }
        } else if (baseCmd === "equip") {
            const itemId = args[1];
            const item = ITEM_DATABASE[itemId];
            if (item && item.type === "equipment") {
                let level = parseInt(args[2]);
                if (isNaN(level)) level = 0;
                level = Math.max(0, Math.min(MAX_ENHANCE_LEVEL, level));
                const instance = createEquipmentInstance(itemId, level);
                p.inventory.push(instance);
                EquipmentSystem.equip(instance.uid);
                logText += `${item.name} (+${level}) を装備しました。`;
            } else logText += "エラー: 装備可能なアイテムIDを指定してください。";
        } else if (baseCmd === "unequip") {
            const slot = args[1];
            if (p.equipment && Object.prototype.hasOwnProperty.call(p.equipment, slot)) {
                EquipmentSystem.unequip(slot);
                logText += `[${slot}] の装備を外しました。`;
            } else logText += "エラー: スロット名(head/body/leftHand/rightHand/neck/feet)を指定してください。";
        } else if (baseCmd === "warp") {
            const mapId = args[1];
            const validMaps = ["outside", "inside", "shop", "blacksmith", "dungeon"];
            if (validMaps.includes(mapId)) {
                transitionArea(mapId);
                logText += `エリア [${mapId}] にワープしました。`;
            } else logText += `引数エラー: warp [${validMaps.join("/")}] を指定してください。`;
        } else if (baseCmd === "npc") {
            const npcId = args[1];
            const targetNPC = NPCs.find(n => n.id === npcId);
            if (targetNPC) {
                targetNPC.x = p.x;
                targetNPC.y = p.y;
                logText += `NPC [${npcId}] を現在地に召喚しました。`;
            } else logText += "エラー: NPCが見つかりません。";
        } else {
            logText += "不明なコマンドです。'help' と入力してコマンド一覧を確認してください。";
        }

        outputDiv.innerText += `\n${logText}`;
        outputDiv.scrollTop = outputDiv.scrollHeight;
        UIManager.updateUI();
        SaveSystem.save();
    }
};

const Canvas = document.getElementById("game-canvas");
const ctx = Canvas.getContext("2d");

function resizeCanvas() {
    // iPhoneで疑似回転(強制横画面)が効いている間は、実際のウィンドウの縦横が
    // 見た目上入れ替わっているので、キャンバスの解像度もそれに合わせて入れ替える。
    const rotated = document.documentElement.classList.contains("is-iphone") &&
        window.matchMedia("(orientation: portrait)").matches;
    const availW = rotated ? window.innerHeight : window.innerWidth;
    const availH = rotated ? window.innerWidth : window.innerHeight;

    Canvas.width = Math.min(availW, 480);
    Canvas.height = Math.min(availH, 480);
    ctx.imageSmoothingEnabled = false;

    // レイアウト確定後に重ねる (canvasの表示サイズが変わった直後の1フレームはズレることがあるため)
    requestAnimationFrame(syncMessageLogToCanvas);
}
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);

// メッセージログ(「商店に入った」等)だけは、実際に描画されているゲーム画面(canvas)の
// 左下にぴったり重ねる。ミニマップ/プレイヤー名/所持金/メニューボタンはゲーム画面の外側
// (画面全体)に固定したままでよいので、それらを含む#ui-overlay自体はいじらない。
function syncMessageLogToCanvas() {
    const canvas = document.getElementById("game-canvas");
    const log = document.getElementById("message-log");
    const container = document.getElementById("game-container");
    if (!canvas || !log || !container) return;

    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const left = (canvasRect.left - containerRect.left) + 10;
    const bottom = (containerRect.bottom - canvasRect.bottom) + 15;

    log.style.left = left + "px";
    log.style.bottom = bottom + "px";
}

let animClock = 0;

function gameLoop(timestamp) {
    animClock = timestamp || 0;
    update(timestamp);
    render();
    renderMinimap();
    requestAnimationFrame(gameLoop);
}

// 待機中のキャラクターに小さな上下の揺れをつける (position + phase から算出するので毎フレーム計算しなおしてOK)
function getIdleBob(phase) {
    return Math.sin(animClock * 0.004 + phase) * 1.5;
}

// 位置から安定した位相を作る (キャラごとに揺れのタイミングをずらして、全員が同時に揺れないようにする)
function phaseFromPosition(x, y) {
    return ((x * 0.13 + y * 0.29) % (Math.PI * 2));
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
                const bob = getIdleBob(phaseFromPosition(npc.x, npc.y));
                ctx.drawImage(tex, npc.x - camX, npc.y - camY + bob, TILE_SIZE, TILE_SIZE);
            }
        }
    });

    if (GameState.currentMap === "outside" || GameState.currentMap === "dungeon") {
        GameState.spawnedEnemies.forEach(e => {
            if (e.map !== GameState.currentMap) return;
            const tex = TextureEngine.canvasCache[e.texture];
            if (tex) {
                const bob = getIdleBob(phaseFromPosition(e.x, e.y));
                ctx.drawImage(tex, e.x - camX, e.y - camY + bob, TILE_SIZE, TILE_SIZE);
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
    const viewTiles = 40; 
    
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

// 3本指タッチで暗号入力欄を呼び出す (キーボードが無いタッチ端末でも「開発者の眼」を入手できるようにする)
function initSecretInput() {
    const box = document.getElementById("secret-input-box");
    const input = document.getElementById("secret-input");
    if (!box || !input) return;

    let isOpen = false;

    const openBox = () => {
        if (isOpen) return;
        isOpen = true;
        box.classList.remove("hidden");
        input.value = "";
        input.focus();
        addLog("何かの気配を感じ、文字を入力できるようになった…");
    };

    const closeBox = () => {
        isOpen = false;
        box.classList.add("hidden");
        input.blur();
    };

    document.addEventListener("touchstart", (e) => {
        if (e.touches.length === 3) {
            openBox();
        }
    }, { passive: true });

    const checkValue = () => {
        if (input.value.trim().toUpperCase() === "RISA") {
            unlockUniqueSkill("console");
            closeBox();
        }
    };

    input.addEventListener("input", checkValue);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            checkValue();
            closeBox();
        } else if (e.key === "Escape") {
            closeBox();
        }
    });
    input.addEventListener("blur", () => {
        setTimeout(closeBox, 150);
    });
}

window.addEventListener("DOMContentLoaded", async () => {
    applyIphoneLandscapeLock();
    resizeCanvas();
    syncMessageLogToCanvas();
    initSecretInput();
    TextureEngine.init();
    await MapManager.init();
    SaveSystem.load();
    InputHandler.init();
    UIManager.init();
    DebugConsole.init();

    requestAnimationFrame(gameLoop);
});
