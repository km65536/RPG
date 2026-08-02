/**
 * スキルデータ
 * data/items.js より後に読み込むこと (スキルブックを ITEM_DATABASE に追加するため)。
 *
 * 新しいスキルを追加する方法:
 *  1. SKILL_DATABASE にスキルを追加する
 *  2. 通常入手させたい場合は SKILL_BOOK_DEFS に { skillId, cost } を追加する
 *     (スキルブックのアイテムは自動生成される)
 *  3. スキルレベルの概念を持たせたくない特別なスキルは type: "unique" にする
 *     (この場合スキルブックは作らず、main.js 側で個別の入手手段を用意する)
 */

const SKILL_DATABASE = {
    // --- 攻撃スキル ---
    power_slash: { id: "power_slash", name: "パワースラッシュ", mpCost: 5, power: 1.5, type: "attack", element: "physical", description: "威力の高い物理攻撃", baseSpCost: 1, spCostGrowth: 1 },
    fireball: { id: "fireball", name: "ファイアボール", mpCost: 12, power: 2.0, type: "attack", element: "fire", description: "炎の魔法攻撃", baseSpCost: 2, spCostGrowth: 2 },
    ice_lance: { id: "ice_lance", name: "アイスランス", mpCost: 12, power: 2.0, type: "attack", element: "ice", description: "氷の槍を放つ魔法攻撃", baseSpCost: 2, spCostGrowth: 2 },
    thunder_strike: { id: "thunder_strike", name: "サンダーストライク", mpCost: 14, power: 2.3, type: "attack", element: "thunder", description: "雷を落とす魔法攻撃", baseSpCost: 2, spCostGrowth: 2 },
    shadow_slash: { id: "shadow_slash", name: "シャドウスラッシュ", mpCost: 9, power: 2.1, type: "attack", element: "dark", description: "影に紛れて放つ鋭い斬撃", baseSpCost: 2, spCostGrowth: 2 },
    holy_burst: { id: "holy_burst", name: "ホーリーバースト", mpCost: 20, power: 3.0, type: "attack", element: "holy", description: "聖なる光の爆発", baseSpCost: 3, spCostGrowth: 2 },
    dragon_fang: { id: "dragon_fang", name: "ドラゴンファング", mpCost: 25, power: 3.5, type: "attack", element: "physical", description: "竜の牙を模した渾身の一撃", baseSpCost: 4, spCostGrowth: 3 },

    // --- 回復スキル ---
    heal: { id: "heal", name: "ヒール", mpCost: 8, power: 50, type: "heal", description: "HPを回復する魔法", baseSpCost: 2, spCostGrowth: 1 },
    mega_heal: { id: "mega_heal", name: "メガヒール", mpCost: 18, power: 120, type: "heal", description: "大きくHPを回復する上級魔法", baseSpCost: 3, spCostGrowth: 2 },
    full_restore: { id: "full_restore", name: "フルリストア", mpCost: 30, power: 9999, type: "heal", description: "HPを完全に回復する秘術", baseSpCost: 5, spCostGrowth: 3 },

    // --- パッシブ (ステータス上昇、レベルごとに加算) ---
    power_within: { id: "power_within", name: "剛力の心得", type: "passive_stat", statKey: "str", valuePerLevel: 2, description: "レベルごとにSTRが上昇する", baseSpCost: 2, spCostGrowth: 1 },
    iron_body: { id: "iron_body", name: "鉄壁の心得", type: "passive_stat", statKey: "vit", valuePerLevel: 2, description: "レベルごとにVITが上昇する", baseSpCost: 2, spCostGrowth: 1 },
    swift_feet: { id: "swift_feet", name: "疾風の心得", type: "passive_stat", statKey: "agi", valuePerLevel: 2, description: "レベルごとにAGIが上昇する", baseSpCost: 2, spCostGrowth: 1 },
    mana_well: { id: "mana_well", name: "魔力の泉", type: "passive_stat", statKey: "maxMp", valuePerLevel: 5, description: "レベルごとに最大MPが上昇する", baseSpCost: 2, spCostGrowth: 1 },
    vital_spirit: { id: "vital_spirit", name: "生命の意志", type: "passive_stat", statKey: "maxHp", valuePerLevel: 10, description: "レベルごとに最大HPが上昇する", baseSpCost: 2, spCostGrowth: 1 },

    // --- パッシブ (特殊効果、レベルごとに割合が増加) ---
    exp_boost: { id: "exp_boost", name: "修練の心得", type: "passive_special", effectType: "expBoost", baseValue: 0.2, valuePerLevel: 0.1, description: "戦闘勝利時の獲得経験値が割合で増加する", baseSpCost: 3, spCostGrowth: 3 },
    gold_finder: { id: "gold_finder", name: "金運の心得", type: "passive_special", effectType: "goldBoost", baseValue: 0.2, valuePerLevel: 0.1, description: "戦闘勝利時の獲得ゴールドが割合で増加する", baseSpCost: 3, spCostGrowth: 3 },

    // --- ユニークスキル (スキルレベルの概念がなく、SPで強化できない特別なスキル) ---
    console: { id: "console", name: "開発者の眼", type: "unique", description: "隠されたデバッグコンソールを呼び出せるようになる" },
    lucky_charm: { id: "lucky_charm", name: "幸運の護符", type: "unique", description: "戦闘からの逃走が必ず成功するようになる" }
};

// --- スキルブック (通常はこれを使ってスキルを習得する) ---
const SKILL_BOOK_DEFS = [
    { skillId: "fireball", cost: 150 },
    { skillId: "ice_lance", cost: 150 },
    { skillId: "thunder_strike", cost: 180 },
    { skillId: "shadow_slash", cost: 160 },
    { skillId: "holy_burst", cost: 400 },
    { skillId: "dragon_fang", cost: 600 },
    { skillId: "mega_heal", cost: 220 },
    { skillId: "full_restore", cost: 550 },
    { skillId: "power_within", cost: 200 },
    { skillId: "iron_body", cost: 200 },
    { skillId: "swift_feet", cost: 200 },
    { skillId: "mana_well", cost: 200 },
    { skillId: "vital_spirit", cost: 200 },
    { skillId: "gold_finder", cost: 350 }
];

function buildSkillBooks() {
    const db = {};
    SKILL_BOOK_DEFS.forEach(def => {
        const skill = SKILL_DATABASE[def.skillId];
        if (!skill) return;
        const id = `book_${def.skillId}`;
        db[id] = {
            id,
            name: `スキルブック: ${skill.name}`,
            type: "skill_book",
            grantsSkill: def.skillId,
            cost: def.cost,
            sellValue: Math.round(def.cost * 0.4),
            description: `読むと「${skill.name}」を習得できる。`
        };
    });
    return db;
}
Object.assign(ITEM_DATABASE, buildSkillBooks());
