/**
 * 敵・ボスデータ
 * data/constants.js (TILE_SIZE) より後に読み込むこと。
 *
 * 新しい雑魚敵を追加する方法:
 *  - ENEMY_DATABASE に追加する。minLevel でプレイヤーの出現可能レベルを、
 *    dungeonOnly: true でダンジョン限定の敵にできる。
 * 新しいボスを追加する方法:
 *  - BOSS_DATABASE にエントリを追加し、main.js 側の ensureDungeonBoss 相当の
 *    配置処理を作る (現状は dungeon_lord のみ、ダンジョン奥に固定配置)。
 */

// 属性の表示名 (弱点/耐性の表示・ログ用)
const ELEMENT_LABELS = { physical: "物理", fire: "炎", ice: "氷", thunder: "雷", holy: "光", dark: "闇" };

// weakness: 弱点属性 (被ダメージ+50%) / resist: 耐性属性 (被ダメージ-50%)
const ENEMY_DATABASE = [
    { name: "水辺のスライム", hp: 30, str: 12, vit: 4, rewardExp: 35, rewardGold: 15, texture: "enemy_slime", minLevel: 1, weakness: "thunder", resist: "physical" },
    { name: "森のゴブリン", hp: 45, str: 16, vit: 6, rewardExp: 50, rewardGold: 25, texture: "enemy_goblin", minLevel: 1, weakness: "fire", resist: "dark" },
    { name: "洞窟コウモリ", hp: 25, str: 14, vit: 2, rewardExp: 40, rewardGold: 18, texture: "enemy_bat", minLevel: 2, weakness: "holy", resist: "dark" },
    { name: "野生のウルフ", hp: 55, str: 20, vit: 5, rewardExp: 60, rewardGold: 30, texture: "enemy_wolf", minLevel: 3, weakness: "ice", resist: "physical" },
    { name: "岩のゴーレム", hp: 90, str: 22, vit: 15, rewardExp: 100, rewardGold: 60, texture: "enemy_golem", minLevel: 5, weakness: "thunder", resist: "physical" },
    { name: "ダンジョンの影狼", hp: 70, str: 24, vit: 8, rewardExp: 90, rewardGold: 45, texture: "enemy_wolf", minLevel: 4, weakness: "holy", resist: "dark", dungeonOnly: true }
];

// ボス (通常のエンカウントでは出現せず、ダンジョンの奥に固定で待ち構えている)
const BOSS_DATABASE = {
    dungeon_lord: {
        name: "ダンジョンの主 ストーンロード",
        hp: 400,
        str: 30,
        vit: 18,
        rewardExp: 500,
        rewardGold: 300,
        texture: "boss_stone_lord",
        weakness: "thunder",
        resist: "physical",
        x: 6 * TILE_SIZE,
        y: 1 * TILE_SIZE
    }
};
