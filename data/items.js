/**
 * アイテム・装備データ
 *
 * 新しいアイテムを追加する方法:
 *  - 消費アイテム/固定装備は ITEM_DATABASE に直接追加する
 *  - 素材違いの武器/盾/鎧を増やしたい場合は MATERIAL_TIERS や EQUIPMENT_FAMILIES を編集する
 * スキルブックは data/skills.js 側で ITEM_DATABASE に追加される (skills.js を後で読み込むこと)。
 */

// 装備スロットの表示名・並び順 (右手/左手を分離し、盾と剣を同時装備できるようにする)
const SLOT_LABELS = { head: "頭", body: "胴体", rightHand: "右手", leftHand: "左手", neck: "首", feet: "足" };
const SLOT_ORDER = ["head", "body", "rightHand", "leftHand", "neck", "feet"];

// ステータスキーの表示名 (装備/スキルのボーナス表示用)
const STAT_LABELS = { maxHp: "最大HP", maxMp: "最大MP", str: "STR", agi: "AGI", vit: "VIT" };

// 装備強化の設定 (鍛冶場で強化できる上限と、1レベルごとのステータス倍率)
const MAX_ENHANCE_LEVEL = 5;
const ENHANCE_BONUS_PER_LEVEL = 0.25;

const ITEM_DATABASE = {
    // --- 消費アイテム ---
    // effect: { stat: "hp"|"mp", value: 数値 or "full" }
    herb: { id: "herb", name: "薬草", type: "consumable", cost: 10, sellValue: 5, description: "HPを30回復する", effect: { stat: "hp", value: 30 } },
    potion: { id: "potion", name: "魔導ポーション", type: "consumable", cost: 100, sellValue: 40, description: "HPを完全回復する", effect: { stat: "hp", value: "full" } },
    ether: { id: "ether", name: "エーテル", type: "consumable", cost: 30, sellValue: 15, description: "MPを20回復する", effect: { stat: "mp", value: 20 } },

    // --- 装備品 (頭/首/足は素材による量産はせず固定アイテム) ---
    // slot: "head"|"body"|"feet"|"neck"|"leftHand"|"rightHand"
    // stats: 装備時に加算されるステータスボーナス (強化レベルに応じて増幅される)
    // specialEffect: ステータス以外の特殊効果 (任意)
    leather_hat: { id: "leather_hat", name: "革の帽子", type: "equipment", slot: "head", cost: 35, sellValue: 12, description: "身のこなしが少し良くなる帽子", stats: { agi: 3 } },
    leather_boots: { id: "leather_boots", name: "革のブーツ", type: "equipment", slot: "feet", cost: 45, sellValue: 18, description: "俊敏性が上がる軽量なブーツ", stats: { agi: 5 } },
    silver_amulet: { id: "silver_amulet", name: "銀のアミュレット", type: "equipment", slot: "neck", cost: 120, sellValue: 50, description: "最大MPを高め、獲得経験値が少し増える首飾り", stats: { maxMp: 15 }, specialEffect: { type: "expBoost", value: 0.1 } }
};

// --- 素材ランクによる武器/盾/鎧の自動生成 ---
// 木 → 石 → 銅 → 鉄 → 銀 → 金 → ダイヤ → アダマンタイト の順に強くなる
const MATERIAL_TIERS = [
    { key: "wood", name: "木", multiplier: 1.0, baseCost: 20 },
    { key: "stone", name: "石", multiplier: 1.5, baseCost: 40 },
    { key: "bronze", name: "銅", multiplier: 2.0, baseCost: 70 },
    { key: "iron", name: "鉄", multiplier: 2.7, baseCost: 120 },
    { key: "silver", name: "銀", multiplier: 3.6, baseCost: 200 },
    { key: "gold", name: "金", multiplier: 4.8, baseCost: 320 },
    { key: "diamond", name: "ダイヤ", multiplier: 6.4, baseCost: 500 },
    { key: "adamantite", name: "アダマンタイト", multiplier: 8.5, baseCost: 800 }
];

const EQUIPMENT_FAMILIES = [
    { key: "sword", nameSuffix: "の剣", slot: "rightHand", costFactor: 1.0, statFn: (m) => ({ str: Math.round(4 * m) }) },
    { key: "shield", nameSuffix: "の盾", slot: "leftHand", costFactor: 0.8, statFn: (m) => ({ vit: Math.round(4 * m) }) },
    { key: "armor", nameSuffix: "の鎧", slot: "body", costFactor: 1.3, statFn: (m) => ({ maxHp: Math.round(10 * m), vit: Math.round(2 * m) }) }
];

function buildTieredEquipment() {
    const db = {};
    MATERIAL_TIERS.forEach(mat => {
        EQUIPMENT_FAMILIES.forEach(fam => {
            const id = `${mat.key}_${fam.key}`;
            const cost = Math.round(mat.baseCost * fam.costFactor);
            db[id] = {
                id,
                name: `${mat.name}${fam.nameSuffix}`,
                type: "equipment",
                slot: fam.slot,
                cost,
                sellValue: Math.round(cost * 0.4),
                description: `${mat.name}で作られた${SLOT_LABELS[fam.slot]}装備。`,
                stats: fam.statFn(mat.multiplier)
            };
        });
    });
    return db;
}
Object.assign(ITEM_DATABASE, buildTieredEquipment());
