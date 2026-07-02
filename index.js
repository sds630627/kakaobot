'use strict';

// index.js — 타짜봇 v3 (시즌제/가챠/업적/바카라/1:1주사위/은행/config.json)
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'users.json');
const MARKET_FILE = path.join(__dirname, 'market.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

const server = dgram.createSocket('udp4');

// ═══════════════════════════════════════════════════════
// 1. CONFIG 로드/저장
// ═══════════════════════════════════════════════════════
const DEFAULT_CONFIG = {
    fees: { sutda: 10, blackjack: 5, baccarat: 8, numberGuess: 5, duel: 8 },
    sutda: { dealerDieMaxChance: 15 },
    gacha: {
        초급상자: { price: 100000, rates: { 일반: 75, 희귀: 20, 영웅: 4, 전설: 1, 신화: 0, 꽝: 0 } },
        중급상자: { price: 1000000, rates: { 일반: 50, 희귀: 30, 영웅: 15, 전설: 4, 신화: 0, 꽝: 1 } },
        고급상자: { price: 10000000, rates: { 일반: 25, 희귀: 35, 영웅: 28, 전설: 10, 신화: 1, 꽝: 1 } },
        영웅상자: { price: 100000000, rates: { 일반: 0, 희귀: 15, 영웅: 55, 전설: 25, 신화: 5, 꽝: 0 } },
        전설상자: { price: 1000000000, rates: { 일반: 0, 희귀: 0, 영웅: 25, 전설: 55, 신화: 20, 꽝: 0 } },
        신화상자: { price: 10000000000, rates: { 일반: 0, 희귀: 0, 영웅: 5, 전설: 35, 신화: 60, 꽝: 0 } }
    },
    coin: { updateIntervalMinutes: 10, maxChangePercent: 40 },
    loan: { maxRatio: 0.5, hourlyInterestRate: 5 },
    deposit: { graceMinutes: 20, hourlyInterestRate: 0.05 },
    employee: { taxRate: 20 },
    // Phase 2: 장비상자 (등급 고정 드랍, 부위만 랜덤)
    equipmentBox: {
        초급장비상자: { price: 50000 },
        중급장비상자: { price: 300000 },
        고급장비상자: { price: 2000000 },
        영웅장비상자: { price: 15000000 },
        전설장비상자: { price: 100000000 },
        신화장비상자: { price: 800000000 }
    },
    // Phase 2: 용병상자 (등급 고정, 해당 등급 파티원 지급)
    mercenaryBox: {
        초급용병상자: { price: 80000 },
        중급용병상자: { price: 500000 },
        고급용병상자: { price: 3000000 },
        영웅용병상자: { price: 20000000 },
        전설용병상자: { price: 150000000 },
        신화용병상자: { price: 1000000000 }
    },
    // 장비상자 개봉 시 부위별 드랍 확률(가중치)
    equipDropRate: { weapon: 20, armor: 20, shield: 20, ring: 40 },
    // 장비상점 (초급 등급만 판매)
    equipShop: { weapon: 3000, armor: 3000, shield: 5000, ring: 8000 },
    // Phase 3: 사냥터
    hunt: { minMinutes: 5, maxMinutes: 480, breakChance: 0 }, // breakChance 사냥에선 0 (보스만)
    newsAdmins: ['A', '박성빈'],
    quiz: {
        rewardPool: [
            { type: 'cash', value: 1000, weight: 30 },
            { type: 'cash', value: 5000, weight: 25 },
            { type: 'cash', value: 10000, weight: 20 },
            { type: 'cash', value: 50000, weight: 10 },
            { type: 'cash', value: 100000, weight: 7 },
            { type: 'box', value: '초급상자', weight: 5 },
            { type: 'box', value: '중급상자', weight: 2 },
            { type: 'box', value: '고급상자', weight: 0.8 },
            { type: 'box', value: '영웅상자', weight: 0.15 },
            { type: 'box', value: '전설상자', weight: 0.04 },
            { type: 'box', value: '신화상자', weight: 0.01 }
        ]
    }
};

let CONFIG = {};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            CONFIG = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), parsed);
        } else {
            CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            saveConfig();
        }
    } catch (e) {
        console.error('config.json 로드 실패:', e.message);
        CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG, null, 2), 'utf8');
    } catch (e) {
        console.error('config.json 저장 실패:', e.message);
    }
}

function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

function getConfigValue(dotPath) {
    const keys = dotPath.split('.');
    let obj = CONFIG;
    for (const k of keys) {
        if (obj == null || typeof obj !== 'object') return undefined;
        obj = obj[k];
    }
    return obj;
}

function setConfigValue(dotPath, value) {
    const keys = dotPath.split('.');
    let obj = CONFIG;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') obj[keys[i]] = {};
        obj = obj[keys[i]];
    }
    const lastKey = keys[keys.length - 1];
    const num = parseFloat(value);
    obj[lastKey] = !isNaN(num) ? num : value;
    saveConfig();
}

// ═══════════════════════════════════════════════════════
// 2. 정적 데이터
// ═══════════════════════════════════════════════════════
const COIN_NAMES = ['성빈코인', '호근코인', '정재코인', '몰탈코인', '펭즈코인', '첨지코인'];
const ADMIN_NAMES = ['A', '박성빈'];

const MAN = 10000;
const EOK = 100000000;
const JO = 1000000000000;

// DEFAULT_LUXURY: RPG 개편으로 제거됨


const DEFAULT_COIN = {
    '성빈코인': { currentPrice: 1000, lastPrice: 1000, desc: '하이리스크 코인' },
    '호근코인': { currentPrice: 1000, lastPrice: 1000, desc: '안정 추구형 코인' },
    '정재코인': { currentPrice: 1000, lastPrice: 1000, desc: '상장폐지 위험 잡코인' },
    '몰탈코인': { currentPrice: 1000, lastPrice: 1000, desc: '신생 다크호스 코인' },
    '펭즈코인': { currentPrice: 1000, lastPrice: 1000, desc: '커뮤니티 밈 코인' },
    '첨지코인': { currentPrice: 1000, lastPrice: 1000, desc: '큰손이 움직이는 코인' }
};

// ─────────────────────────────────────────────
// 파티원(직원) 시스템 — RPG 컨셉으로 완전 재설계
// 등급별 캐릭터 라인업, 각자 고유 스킬 보유
// ─────────────────────────────────────────────
const PARTY_MEMBERS = {
    '김판돌':       { grade: '초급', baseSkillPower: 5,   skill: 'atkBuff',   skillDesc: '20% 확률 발동 - 다음 공격 데미지 +20%' },
    '나칼치':       { grade: '중급', baseSkillPower: 10,  skill: 'defBuff',   skillDesc: '20% 확률 발동 - 이번 턴 받는 데미지 -30%' },
    '도끼눈 최씨':  { grade: '고급', baseSkillPower: 20,  skill: 'heal',      skillDesc: '25% 확률 발동 - HP 15% 회복' },
    '흑룡 강':      { grade: '영웅', baseSkillPower: 40,  skill: 'critUp',    skillDesc: '25% 확률 발동 - 다음 공격 크리티컬 100%' },
    '백호 백작':    { grade: '전설', baseSkillPower: 80,  skill: 'pierce',    skillDesc: '30% 확률 발동 - 다음 공격 방어무시(관통)' },
    '무당벌레':     { grade: '신화', baseSkillPower: 150, skill: 'doubleAtk', skillDesc: '30% 확률 발동 - 이번 턴 2회 공격' },
    '검은 지배자':  { grade: '태초', baseSkillPower: 300, skill: 'ultimate',  skillDesc: '35% 확률 발동 - 강력한 진명해방 (관통+2회공격+회복)' }
};

// 용병 스킬 타입별 역할 라벨 (파티 편성 시 UI 안내용)
const ROLE_LABEL = {
    atkBuff:   '⚔️ 버퍼(공격)',
    defBuff:   '🛡️ 탱커(방어)',
    heal:      '💚 힐러',
    critUp:    '🎯 딜러(크리티컬)',
    pierce:    '🗡️ 딜러(관통)',
    doubleAtk: '⚡ 딜러(연타)',
    ultimate:  '🌌 올라운더'
};


// 공백 있는 파티원 이름을 args 배열에서 매칭
// 예: args = ['A', '검은', '지배자', '3'] → { name: '검은 지배자', restArgs: ['3'] }
function matchPartyMemberFromArgs(args, startIdx) {
    const memberNames = Object.keys(PARTY_MEMBERS);
    // 긴 이름부터 매칭 시도 (2단어 이름 우선)
    const sorted = memberNames.sort((a, b) => b.split(' ').length - a.split(' ').length);
    for (const name of sorted) {
        const parts = name.split(' ');
        const slice = args.slice(startIdx, startIdx + parts.length).join(' ');
        if (slice === name) {
            return { name, nextIdx: startIdx + parts.length };
        }
    }
    return null;
}

// 파티원 스킬 이름 로그용
const PARTY_SKILL_MESSAGES = {
    atkBuff:   (n) => `⚡ ${n}이(가) 나타나 공격력을 끌어올립니다!`,
    defBuff:   (n) => `🛡️ ${n}이(가) 방벽을 세워 피해를 줄입니다!`,
    heal:      (n) => `💚 ${n}이(가) 상처를 치유합니다!`,
    critUp:    (n) => `🎯 ${n}이(가) 급소를 노립니다! 크리티컬 확정!`,
    pierce:    (n) => `🗡️ ${n}이(가) 방어를 꿰뚫는 일격을 준비합니다!`,
    doubleAtk: (n) => `⚡⚡ ${n}이(가) 잔영을 만들며 연격을 시전합니다!`,
    ultimate:  (n) => `🌌 ${n}이(가) 진명해방! 세계가 무너집니다!`
};

// ─────────────────────────────────────────────
// Phase 2: 장비 시스템
// ─────────────────────────────────────────────
const EQUIP_GRADES = ['초급', '중급', '고급', '영웅', '전설', '신화', '태초'];
const EQUIP_BOX_GRADES = ['초급', '중급', '고급', '영웅', '전설', '신화']; // 태초는 상자로 뽑지 않음
const EQUIP_GRADE_EMOJI = { 초급: '⚪', 중급: '🟢', 고급: '🔵', 영웅: '🟣', 전설: '🟠', 신화: '🔴', 태초: '🌌' };

// 부위별 등급 기본 스탯
const WEAPON_ATK  = { 초급: 5,  중급: 15, 고급: 35, 영웅: 80,  전설: 150, 신화: 280, 태초: 500 };
const ARMOR_DEF   = { 초급: 3,  중급: 8,  고급: 20, 영웅: 45,  전설: 80,  신화: 130, 태초: 200 };
const ARMOR_HP    = { 초급: 30, 중급: 80, 고급: 180,영웅: 350, 전설: 550, 신화: 780, 태초: 1000 };
const SHIELD_DEF  = { 초급: 5,  중급: 15, 고급: 35, 영웅: 70,  전설: 130, 신화: 200, 태초: 300 };
const RING_BUDGET = { 초급: 4,  중급: 10, 고급: 25, 영웅: 55,  전설: 100, 신화: 180, 태초: 320 };

const SLOT_LABEL = { weapon: '🗡️ 무기', armor: '🛡️ 방어구', shield: '🔰 방패', ring1: '💍 반지1', ring2: '💍 반지2' };
const SLOT_ALIASES = {
    무기: 'weapon', weapon: 'weapon',
    방어구: 'armor', armor: 'armor',
    방패: 'shield', shield: 'shield',
    반지1: 'ring1', ring1: 'ring1',
    반지2: 'ring2', ring2: 'ring2',
    반지: 'ring' // 인벤/구매 시 부위타입으로만 쓰임(어느 반지칸이든 가능)
};

// 특수 옵션(효과) 풀 — 같은 부위/등급이라도 서로 다른 조합이 나오도록 함.
// value는 등급 인덱스(0~6)에 비례해 스케일링됨. 실제 전투(사냥/레이드) 계산에서 참조.
const EFFECT_POOL = [
    { id: 'crit',      label: '치명타 확률',   appliesTo: ['weapon', 'ring'],          unit: '%', baseVal: 2,  perGrade: 1.2, desc: v => `치명타 확률 +${v}%` },
    { id: 'critdmg',   label: '치명타 피해',   appliesTo: ['weapon', 'ring'],          unit: '%', baseVal: 8,  perGrade: 5,   desc: v => `치명타 피해 +${v}%` },
    { id: 'pierce',    label: '방어관통',      appliesTo: ['weapon'],                  unit: '%', baseVal: 3,  perGrade: 2.5, desc: v => `방어관통 +${v}%` },
    { id: 'bossdmg',   label: '보스전 데미지', appliesTo: ['weapon', 'ring'],          unit: '%', baseVal: 3,  perGrade: 2,   desc: v => `보스 상대 데미지 +${v}%` },
    { id: 'lifesteal', label: '흡혈',          appliesTo: ['weapon', 'ring'],          unit: '%', baseVal: 2,  perGrade: 1.5, desc: v => `공격 시 데미지의 ${v}% 흡혈` },
    { id: 'thorns',    label: '반격',          appliesTo: ['armor', 'shield'],         unit: '%', baseVal: 3,  perGrade: 2,   desc: v => `피격 시 ${v}% 데미지 반사` },
    { id: 'dodge',     label: '회피율',        appliesTo: ['armor', 'shield', 'ring'], unit: '%', baseVal: 1,  perGrade: 0.8, desc: v => `회피율 +${v}%` },
    { id: 'regen',     label: '재생',          appliesTo: ['armor', 'ring'],           unit: '%', baseVal: 1,  perGrade: 0.7, desc: v => `매 턴 최대체력의 ${v}% 회복` },
    { id: 'guard',     label: '철벽',          appliesTo: ['shield'],                  unit: '%', baseVal: 3,  perGrade: 2,   desc: v => `받는 피해 ${v}% 감소` },
    { id: 'proc',      label: '용병 발동률',   appliesTo: ['ring'],                    unit: '%', baseVal: 2,  perGrade: 1.5, desc: v => `용병 스킬 발동확률 +${v}%` },
    { id: 'mana',      label: '마력',          appliesTo: ['weapon', 'armor', 'ring'], unit: '',  baseVal: 5,  perGrade: 8,   desc: v => `최대 마력 +${v}` },
    { id: 'manaRegen', label: '마력회복',      appliesTo: ['ring', 'armor'],           unit: '',  baseVal: 1,  perGrade: 0.5, desc: v => `턴당 마력회복 +${v}` },
];
const EFFECT_ATTACH_CHANCE = 0.4; // 아이템 생성 시 특수옵션이 붙을 확률

function rollEquipmentEffect(slotType, grade) {
    if (Math.random() >= EFFECT_ATTACH_CHANCE) return null;
    const gradeIdx = Math.max(0, EQUIP_GRADES.indexOf(grade));
    const pool = EFFECT_POOL.filter(e => e.appliesTo.includes(slotType));
    if (pool.length === 0) return null;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const value = Math.round((picked.baseVal + picked.perGrade * gradeIdx) * 10) / 10;
    return { id: picked.id, label: picked.label, value, unit: picked.unit, desc: picked.desc(value) };
}

let EQUIP_ID_SEQ = 0;
function nextEquipId() {
    EQUIP_ID_SEQ += 1;
    return `eq${Date.now().toString(36)}${EQUIP_ID_SEQ}${Math.floor(Math.random()*1000)}`;
}

// slotType: 'weapon' | 'armor' | 'shield' | 'ring' (반지는 장착시 ring1/ring2 선택)
function createEquipmentItem(slotType, grade) {
    let atk = 0, def = 0, hp = 0, name = '';
    if (slotType === 'weapon') {
        atk = WEAPON_ATK[grade] || 0;
        name = `${grade} 무기`;
    } else if (slotType === 'armor') {
        def = ARMOR_DEF[grade] || 0;
        hp  = ARMOR_HP[grade] || 0;
        name = `${grade} 방어구`;
    } else if (slotType === 'shield') {
        def = SHIELD_DEF[grade] || 0;
        name = `${grade} 방패`;
    } else if (slotType === 'ring') {
        const pool = ['atk', 'def', 'hp'];
        const dual = Math.random() < 0.35;
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const picks = dual ? shuffled.slice(0, 2) : [shuffled[0]];
        const budget = RING_BUDGET[grade] || 0;
        const per = dual ? budget / 2 : budget;
        for (const stat of picks) {
            if (stat === 'atk') atk += Math.round(per);
            else if (stat === 'def') def += Math.round(per);
            else hp += Math.round(per * 5); // HP는 체감상 크게
        }
        const labelMap = { atk: '공격', def: '방어', hp: '체력' };
        name = `${grade} 반지(${picks.map(p => labelMap[p]).join('/')})`;
    }
    const effect = rollEquipmentEffect(slotType, grade);
    if (effect) name += ` [${effect.label}]`;
    return { id: nextEquipId(), slotType, grade, name, atk, def, hp, enhanceLevel: 0, broken: false, effect };
}

// 강화 적용 스탯 (레벨당 +15%). 파손된 장비는 수리 전까지 스탯이 0으로 취급됨.
function effectiveItemStat(item) {
    if (!item) return { atk: 0, def: 0, hp: 0 };
    if (item.broken) return { atk: 0, def: 0, hp: 0 };
    const mult = 1 + (item.enhanceLevel || 0) * 0.15;
    return {
        atk: Math.round((item.atk || 0) * mult),
        def: Math.round((item.def || 0) * mult),
        hp:  Math.round((item.hp  || 0) * mult)
    };
}

// 장비 한 줄 표시용 (통계 + 특수옵션 + 파손여부)
function formatEquipLine(it) {
    if (it.broken) return `💔[파손됨 — !장비수리 필요]`;
    const eff = effectiveItemStat(it);
    const parts = [
        eff.atk ? `공격+${eff.atk}` : null,
        eff.def ? `방어+${eff.def}` : null,
        eff.hp  ? `체력+${eff.hp}`  : null
    ].filter(Boolean);
    if (it.effect) parts.push(it.effect.desc);
    return parts.join(' ') || '(스탯 없음)';
}

// 강화 성공확률 (목표 레벨 1~10 기준, index 0 = +1강화) — 재료 불필요, 확률 하향
const ENHANCE_SUCCESS_RATE = [70, 60, 50, 40, 35, 28, 22, 16, 10, 5];
// +7강화(index 6)부터 실패 시 파괴 확률 적용 (보스전 파괴와 별개)
const ENHANCE_DESTROY_START_LEVEL = 7;
const ENHANCE_DESTROY_RATE = { 7: 20, 8: 35, 9: 50, 10: 70 };

const ENHANCE_GOLD_BASE  = { 초급: 5000,  중급: 20000, 고급: 80000,  영웅: 300000, 전설: 1200000, 신화: 5000000,  태초: 20000000 };
const ENHANCE_STONE_BASE = { 초급: 5,     중급: 10,    고급: 20,     영웅: 40,     전설: 80,      신화: 150,      태초: 300 };

function calcEnhanceCost(grade, targetLevel) {
    return {
        gold: (ENHANCE_GOLD_BASE[grade] || 5000) * targetLevel,
        stones: (ENHANCE_STONE_BASE[grade] || 5) * targetLevel
    };
}

// 장비상자/용병상자 개봉
function rollEquipmentBox(boxType) {
    const grade = boxType.replace('장비상자', '');
    if (!EQUIP_GRADES.includes(grade)) return null;
    const rates = CONFIG.equipDropRate || { weapon: 20, armor: 20, shield: 20, ring: 40 };
    const total = Object.values(rates).reduce((s, v) => s + v, 0);
    let r = Math.random() * total;
    let slotType = 'weapon';
    for (const [k, w] of Object.entries(rates)) {
        if (r < w) { slotType = k; break; }
        r -= w;
    }
    return createEquipmentItem(slotType, grade);
}

const MERCENARY_BONUS_RATE = 0.01; // % — 상자 등급 용병은 항상 확정, 그 위 등급 용병이 추가로 나올 확률
function rollMercenaryBox(boxType) {
    const grade = boxType.replace('용병상자', '');
    const gradeIdx = EQUIP_GRADES.indexOf(grade);
    const nameOf = (g) => Object.keys(PARTY_MEMBERS).find(n => PARTY_MEMBERS[n].grade === g);
    const base = nameOf(grade);
    if (!base) return null;
    let bonus = null;
    if (gradeIdx >= 0 && gradeIdx < EQUIP_GRADES.length - 1) {
        if (Math.random() * 100 < MERCENARY_BONUS_RATE) {
            bonus = nameOf(EQUIP_GRADES[gradeIdx + 1]);
        }
    }
    return { base, bonus };
}

// 판매가 (등급/부위 기준 골드 환산)
const SELL_PRICE_BASE = { 초급: 2000, 중급: 8000, 고급: 30000, 영웅: 100000, 전설: 400000, 신화: 1500000, 태초: 6000000 };
function calcSellPrice(item) {
    const base = SELL_PRICE_BASE[item.grade] || 1000;
    const enhanceBonus = 1 + (item.enhanceLevel || 0) * 0.2;
    return Math.floor(base * enhanceBonus);
}

// 장비 수리비 (등급 기준)
const REPAIR_GOLD_BASE = { 초급: 3000, 중급: 12000, 고급: 50000, 영웅: 200000, 전설: 800000, 신화: 3000000, 태초: 12000000 };
function calcRepairCost(grade) {
    return REPAIR_GOLD_BASE[grade] || 3000;
}

// 전투력 계산 (스탯랭킹과 동일 공식: 공격x2 + 방어x3 + HPx0.5)
function calcCombatPower(stat) {
    return Math.floor((stat.atk || 0) * 2 + (stat.def || 0) * 3 + (stat.maxHp || stat.hp || 0) * 0.5);
}

// ─────────────────────────────────────────────
// Phase 3: 사냥터
// ─────────────────────────────────────────────
const HUNTING_GROUNDS = [
    { name: '뒷산',        grade: '초급', recommendedPower: 100,    minPower: 30,     goldMin: 500,     goldMax: 2000,     stoneMin: 1,   stoneMax: 3 },
    { name: '어두운 숲',   grade: '중급', recommendedPower: 400,    minPower: 150,    goldMin: 2000,    goldMax: 8000,     stoneMin: 2,   stoneMax: 6 },
    { name: '폐광',        grade: '고급', recommendedPower: 1500,   minPower: 600,    goldMin: 8000,    goldMax: 30000,    stoneMin: 5,   stoneMax: 15 },
    { name: '얼음 동굴',   grade: '영웅', recommendedPower: 6000,   minPower: 2500,   goldMin: 30000,   goldMax: 120000,   stoneMin: 12,  stoneMax: 35 },
    { name: '용의 둥지',   grade: '전설', recommendedPower: 25000,  minPower: 10000,  goldMin: 120000,  goldMax: 500000,   stoneMin: 30,  stoneMax: 90 },
    { name: '천공의 섬',   grade: '신화', recommendedPower: 100000, minPower: 40000,  goldMin: 500000,  goldMax: 2000000,  stoneMin: 80,  stoneMax: 250 },
    { name: '혼돈의 균열', grade: '태초', recommendedPower: 500000, minPower: 200000, goldMin: 2000000, goldMax: 8000000,  stoneMin: 200, stoneMax: 600 }
];

function getHuntingGround(name) {
    return HUNTING_GROUNDS.find(h => h.name === name) || null;
}

// 전투력 미달 → 0%, 권장치 이상 → 최대 95%
function calcHuntSuccessRate(userPower, ground) {
    if (userPower < ground.minPower) return 0;
    const ratio = userPower / ground.recommendedPower;
    const rate = 50 + (ratio - 1) * 50;
    return Math.min(95, Math.max(1, Math.round(rate)));
}

// 진행 중인 사냥 세션 (메모리)
const huntSessions = {}; // `hunt:${sender}` → { ground, startedAt, stat }

// 사냥터별 전리품 테이블 (시간 당 평균 기대값, 실제는 확률적으로 분배)
// 특수 드랍: 등급 맞는 장비상자, 용병상자, 강화석
const HUNT_LOOT_EXTRA = {
    '뒷산':       [ { type: 'box', name: '초급장비상자', chance: 3 }, { type: 'box', name: '초급용병상자', chance: 2 }, { type: 'spell', tier: 1, chance: 5 } ],
    '어두운 숲':  [ { type: 'box', name: '중급장비상자', chance: 2 }, { type: 'box', name: '중급용병상자', chance: 1 }, { type: 'spell', tier: 1, chance: 8 } ],
    '폐광':       [ { type: 'box', name: '고급장비상자', chance: 2 }, { type: 'box', name: '중급용병상자', chance: 3 }, { type: 'stones', amount: [5,15], chance: 20 }, { type: 'spell', tier: 1, chance: 10 }, { type: 'spell', tier: 2, chance: 3 } ],
    '얼음 동굴':  [ { type: 'box', name: '영웅장비상자', chance: 1 }, { type: 'box', name: '고급용병상자', chance: 2 }, { type: 'stones', amount: [10,30], chance: 30 }, { type: 'spell', tier: 2, chance: 5 } ],
    '용의 둥지':  [ { type: 'box', name: '전설장비상자', chance: 1 }, { type: 'box', name: '영웅용병상자', chance: 1 }, { type: 'stones', amount: [20,60], chance: 40 }, { type: 'souls', amount: [1,3], chance: 10 }, { type: 'spell', tier: 2, chance: 8 }, { type: 'spell', tier: 3, chance: 2 } ],
    '천공의 섬':  [ { type: 'box', name: '신화장비상자', chance: 1 }, { type: 'box', name: '전설용병상자', chance: 1 }, { type: 'stones', amount: [50,150], chance: 50 }, { type: 'souls', amount: [2,8], chance: 15 }, { type: 'spell', tier: 3, chance: 4 } ],
    '혼돈의 균열':[ { type: 'box', name: '신화용병상자', chance: 1 }, { type: 'stones', amount: [100,300], chance: 60 }, { type: 'souls', amount: [5,20], chance: 20 }, { type: 'spell', tier: 3, chance: 6 }, { type: 'spell', tier: 4, chance: 1 } ]
};
// 사냥터 드랍: tier에 맞는 랜덤 마법 1종
function rollSpellDrop(tier) {
    const pool = MAGIC_BOOKS.filter(m => m.tier === tier);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)].id;
}

// 사냥 종료 전리품 계산 (경과 시간 기반, 전투력이 높을수록 효율 증가)
function calcHuntLoot(ground, elapsedMin, userPower) {
    const hours = elapsedMin / 60;
    const effMult = Math.min(3.0, Math.max(0.3, userPower / ground.recommendedPower));
    const loot = { gold: 0, stones: 0, souls: 0, boxes: {} };

    // 기본 골드/강화석 (시간당 평균의 랜덤 배율)
    const goldPerHour = (ground.goldMin + ground.goldMax) / 2 * effMult;
    const stonesPerHour = (ground.stoneMin + ground.stoneMax) / 2 * effMult;
    loot.gold  = Math.floor(goldPerHour  * hours * (0.8 + Math.random() * 0.4));
    loot.stones = Math.floor(stonesPerHour * hours * (0.8 + Math.random() * 0.4));

    // 특수 드랍 (시간당 chance% 확률로 1개씩, 최소 보장 없음)
    const extras = HUNT_LOOT_EXTRA[ground.name] || [];
    for (const ex of extras) {
        const rolls = Math.floor(hours) + (Math.random() < (hours % 1) ? 1 : 0);
        for (let i = 0; i < Math.max(1, rolls); i++) {
            if (Math.random() * 100 < ex.chance) {
                if (ex.type === 'box') {
                    loot.boxes[ex.name] = (loot.boxes[ex.name] || 0) + 1;
                } else if (ex.type === 'stones') {
                    loot.stones += Math.floor(ex.amount[0] + Math.random() * (ex.amount[1] - ex.amount[0]));
                } else if (ex.type === 'souls') {
                    loot.souls += Math.floor(ex.amount[0] + Math.random() * (ex.amount[1] - ex.amount[0]));
                } else if (ex.type === 'spell') {
                    const spellId = rollSpellDrop(ex.tier);
                    if (spellId) { if (!loot.spells) loot.spells = []; loot.spells.push(spellId); }
                }
            }
        }
    }
    return loot;
}

// ─────────────────────────────────────────────
// Phase 4: 레이드 보스
// ─────────────────────────────────────────────
const RAID_BOSSES = [
    {
        name: '킹 슬라임', grade: '초급', recommendedPower: 200, minPower: 60,
        maxHp: 500, atk: 12, def: 3,
        gold: 5000, stones: 5, souls: 1,
        enrageHp: 0.3, enrageAtkMult: 1.8,
        desc: '거대한 젤리 덩어리. 작은 슬라임들을 흡수해 힘을 키웠다.'
    },
    {
        name: '숲의 수호자', grade: '중급', recommendedPower: 800, minPower: 300,
        maxHp: 1500, atk: 30, def: 10,
        gold: 20000, stones: 15, souls: 3,
        enrageHp: 0.3, enrageAtkMult: 2.0,
        desc: '고대 숲을 지키는 정령. 분노하면 자연의 힘을 해방한다.'
    },
    {
        name: '철갑 골렘', grade: '고급', recommendedPower: 3000, minPower: 1200,
        maxHp: 5000, atk: 70, def: 30,
        gold: 80000, stones: 40, souls: 8,
        enrageHp: 0.25, enrageAtkMult: 2.2,
        desc: '폐광에서 발굴된 고대 전쟁 병기. 분노 시 핵심 코어가 폭발한다.'
    },
    {
        name: '빙하 용', grade: '영웅', recommendedPower: 12000, minPower: 5000,
        maxHp: 15000, atk: 180, def: 70,
        gold: 300000, stones: 100, souls: 20,
        enrageHp: 0.25, enrageAtkMult: 2.5,
        desc: '얼음 동굴의 지배자. 광폭화하면 절대영도 브레스를 쏟아낸다.'
    },
    {
        name: '용암 군주', grade: '전설', recommendedPower: 50000, minPower: 20000,
        maxHp: 50000, atk: 500, def: 150,
        gold: 1000000, stones: 250, souls: 50,
        enrageHp: 0.3, enrageAtkMult: 2.5,
        desc: '용의 둥지 깊숙이 군림하는 불의 지배자.'
    },
    {
        name: '천공의 군주', grade: '신화', recommendedPower: 200000, minPower: 80000,
        maxHp: 200000, atk: 1500, def: 400,
        gold: 5000000, stones: 600, souls: 120,
        enrageHp: 0.3, enrageAtkMult: 3.0,
        desc: '하늘 위 섬에서 세계를 내려다보는 존재.'
    },
    {
        name: '혼돈의 지배자', grade: '태초', recommendedPower: 1000000, minPower: 400000,
        maxHp: 1000000, atk: 5000, def: 1000,
        gold: 30000000, stones: 2000, souls: 500,
        enrageHp: 0.3, enrageAtkMult: 3.5,
        desc: '모든 것의 근원이자 끝. 세계의 질서를 파괴하려 한다.'
    }
];

// 진행 중인 레이드 세션 (메모리 상 관리, 서버 재시작 시 초기화)
const raidSessions = {}; // roomId -> session

function getRaidBoss(name) {
    return RAID_BOSSES.find(b => b.name === name) || null;
}

// 파티원 스킬 레이드 적용 (전투 중 발동)
function applyPartySkillsRaid(user, state) {
    const effects = { atkMult: 1, defMult: 1, healRatio: 0, crit: false, pierce: false, doubleAtk: false, ultimate: false };
    const procBonus = getEquipmentEffectValue(user, 'proc') / 100; // 용병스킬발동률 옵션 합산
    for (const name of (user.activeParty || [])) {
        const info = PARTY_MEMBERS[name];
        if (!info) continue;
        const p = user.partyMembers[name];
        const baseRate = { atkBuff: 20, defBuff: 20, heal: 25, critUp: 25, pierce: 30, doubleAtk: 30, ultimate: 35 }[info.skill] || 20;
        const rate = Math.min(95, baseRate + procBonus * 100);
        if (Math.random() * 100 < rate) {
            const lvBonus = 1 + (p.level || 0) * 0.05;
            switch (info.skill) {
                case 'atkBuff':   effects.atkMult  += 0.2 * lvBonus; break;
                case 'defBuff':   effects.defMult  += 0.3 * lvBonus; break;
                case 'heal':      effects.healRatio += 0.15 * lvBonus; break;
                case 'critUp':    effects.crit      = true; break;
                case 'pierce':    effects.pierce    = true; break;
                case 'doubleAtk': effects.doubleAtk = true; break;
                case 'ultimate':  effects.ultimate  = true; break;
            }
        }
    }
    return effects;
}

// 장비 특수옵션 값 합산
function getEquipmentEffectValue(user, effectId) {
    let total = 0;
    for (const slot of ['weapon','armor','shield','ring1','ring2']) {
        const it = user.equipment[slot];
        if (it && !it.broken && it.effect && it.effect.id === effectId) {
            total += it.effect.value || 0;
        }
    }
    return total;
}

// 보스 패턴 테이블 — 각 패턴은 '예고' 메시지와 '올바른 반응' 액션을 가짐
// 플레이어가 올바른 액션을 선택하면 보너스, 틀리면 추가 피해
const BOSS_PATTERNS = [
    {
        id: 'crush',
        announce: '💥 보스가 강력한 분쇄 공격을 준비합니다!',
        counter: '방어',
        wrongPenalty: 1.5,
        counterBonus: 0.5,
        counterAttackMult: 1.0,
    },
    {
        id: 'weak',
        announce: '🎯 보스가 방어를 낮추고 약점을 노출합니다!',
        counter: '강공',
        wrongPenalty: 1.0,
        counterBonus: 1.0,
        counterAttackMult: 2.2,
    },
    {
        id: 'heal',
        announce: '💉 보스에게서 회복의 기운이 느껴집니다!',
        counter: '방해',
        wrongPenalty: 0,
        counterBonus: 1.0,
        counterAttackMult: 1.5,
        special: 'blockHeal',
    },
    {
        id: 'charge',
        announce: '⚡ 보스가 땅을 박차며 빠르게 돌진합니다!',
        counter: '회피',
        wrongPenalty: 2.0,
        counterBonus: 0.0,
        counterAttackMult: 1.3,
    },
];

// 다음 보스 패턴 뽑기
function rollBossPattern() {
    return BOSS_PATTERNS[Math.floor(Math.random() * BOSS_PATTERNS.length)];
}


function hpBar(current, max, enraged = false) {
    const cur = Math.max(0, current);
    const ratio = max > 0 ? cur / max : 0;
    const pct = Math.round(ratio * 100);
    const BARS = 20;
    const filled = Math.round(ratio * BARS);
    const empty  = BARS - filled;
    // 체력 구간별 블록 색
    const fillChar = enraged ? '🟥' : pct > 50 ? '🟩' : pct > 25 ? '🟨' : '🟥';
    const emptyChar = '⬜';
    // 블록 이모지가 2바이트라 20개면 너무 길 수 있음 → 10칸 사용
    const B = 10;
    const f = Math.round(ratio * B);
    const e = B - f;
    const bar = fillChar.repeat(f) + emptyChar.repeat(e);
    return `${bar} ${pct}% (${cur.toLocaleString()}/${max.toLocaleString()})`;
}

// 레이드 한 턴 전투 계산
function raidTurn(user, session, statIn, action) {
    let stat = { ...statIn }; // mutable copy
    const boss = session.boss;
    const log = [];

    const critChance   = getEquipmentEffectValue(user, 'crit');
    const critDmgBonus = getEquipmentEffectValue(user, 'critdmg') / 100;
    const piercePct    = getEquipmentEffectValue(user, 'pierce') / 100;
    const bossDmgBonus = getEquipmentEffectValue(user, 'bossdmg') / 100;
    const lifestealPct = getEquipmentEffectValue(user, 'lifesteal') / 100;
    const thornsPct    = getEquipmentEffectValue(user, 'thorns') / 100;
    const dodgePct     = getEquipmentEffectValue(user, 'dodge');
    const regenPct     = getEquipmentEffectValue(user, 'regen');
    const guardPct     = getEquipmentEffectValue(user, 'guard') / 100;

    // 턴 시작: debuff 틱 처리 (화상 등)
    if (!session.bossDebuffs) session.bossDebuffs = [];
    tickBossDebuffs(session, log);
    if (session.bossHp <= 0) return { log, result: 'win' };

    // 마력 자연 회복 (턴당 장비 보너스 + 기본 1)
    const { regen: manaRegen } = calcManaFromEquip(user.equipment);
    session.mana = Math.min(session.maxMana, (session.mana || 0) + 1 + manaRegen);

    // 배리어 상태면 피해 감소
    if (session.playerBarrier > 0) session.playerBarrier--;

    // 패턴 대응 판정
    const pattern = session.pendingPattern || null;
    let patternHit = false;
    let actionAtkMult = 1.0;
    let bossDmgMult = 1.0;
    let blockHeal = false;
    let forceEvade = false;

    if (pattern) {
        patternHit = (action === pattern.counter);
        if (patternHit) {
            actionAtkMult = pattern.counterAttackMult || 1.0;
            bossDmgMult = pattern.counterBonus ?? 1.0;
            if (pattern.special === 'blockHeal') blockHeal = true;
            if (pattern.counter === '회피') forceEvade = true;
            log.push(`✅ 패턴 대응 성공! [${action}]`);
        } else {
            bossDmgMult = pattern.wrongPenalty ?? 1.0;
            log.push(`❌ 패턴 대응 실패! (권장: ${pattern.counter}) → 보스 피해 ×${pattern.wrongPenalty}`);
        }
        session.pendingPattern = null;
    }

    // 파티원 스킬 발동
    const skills = applyPartySkillsRaid(user, session);
    if (skills.atkMult > 1)    log.push(`⚡ 용병 버프: 공격력 ×${skills.atkMult.toFixed(2)}`);
    if (skills.defMult > 1)    log.push(`🛡️ 용병 방어: 피해 감소`);
    if (skills.crit)           log.push(`🎯 용병 크리티컬 확정!`);
    if (skills.pierce)         log.push(`🗡️ 용병 관통 발동!`);
    if (skills.doubleAtk)      log.push(`⚡⚡ 용병 연격 발동!`);
    const hasUltimateAwaken = (user.skills || []).includes('진명해방 각성');
    if (skills.ultimate) {
        skills.crit = true; skills.pierce = true; skills.doubleAtk = true;
        skills.healRatio += hasUltimateAwaken ? 0.2 : 0.1;
        log.push(`🌌 진명해방!${hasUltimateAwaken ? ' (각성+)' : ''}`);
    }

    // 스킬북: 드래곤 블러드 — 매 턴 회복 + 공격력 보너스
    const hasDragonBlood = (user.skills || []).includes('용의 피');
    if (hasDragonBlood) {
        const dbRegen = Math.floor(session.maxHp * 0.02);
        session.hp = Math.min(session.maxHp, session.hp + dbRegen);
        stat = { ...stat, atk: stat.atk + 50 };
        log.push(`🐉 용의 피: +${dbRegen} HP`);
    }

    // HP 회복(재생 옵션)
    if (regenPct > 0) {
        const regen = Math.floor(session.maxHp * regenPct / 100);
        session.hp = Math.min(session.maxHp, session.hp + regen);
        log.push(`💧 재생: +${regen} HP`);
    }

    // 플레이어 공격 (강공 액션 시 추가 배율)
    const isCrit = session.nextCritGuaranteed || skills.crit || Math.random() * 100 < critChance;
    if (session.nextCritGuaranteed) session.nextCritGuaranteed = false;
    // 디버프 적용: 저주(방어력 감소) / 관통 / 전기
    const hasPierce100 = session.bossDebuffs.some(d => d.type === 'pierce100');
    const hasElectrify = session.bossDebuffs.some(d => d.type === 'electrify');
    const defDownPct   = session.bossDebuffs.filter(d => d.type === 'defDown').reduce((s,d) => s+d.value, 0) / 100;
    const effDef = (hasPierce100 || hasElectrify) ? 0 :
        Math.max(0, boss.def * (1 - piercePct - defDownPct) * (1 - (skills.pierce ? 1 : 0)));
    let atkStat = stat.atk * skills.atkMult * actionAtkMult;
    // 스킬북: 강철 의지
    const hasLastStand = (user.skills || []).includes('강철 의지');
    if (hasLastStand && session.hp <= session.maxHp * 0.2) {
        atkStat *= 1.3;
        log.push(`🔥 강철 의지 발동!`);
    }
    let rawDmg = Math.max(1, atkStat - effDef);
    if (isCrit) rawDmg *= (1.5 + critDmgBonus);
    rawDmg *= (1 + bossDmgBonus);
    const hasExtraHit = (user.skills || []).includes('연속타');
    const extraHit = hasExtraHit && Math.random() * 100 < 15;
    const hitCount = (skills.doubleAtk ? 2 : 1) + (extraHit ? 1 : 0);
    let totalDmg = Math.floor(rawDmg) * hitCount;
    session.bossHp = Math.max(0, session.bossHp - totalDmg);
    log.push(`🗡️ ${totalDmg} 피해${isCrit ? ' (크리!)' : ''}${hitCount > 1 ? ` (${hitCount}타)` : ''}${actionAtkMult > 1 ? ` [${action} ×${actionAtkMult}]` : ''}`);

    // 흡혈
    if (lifestealPct > 0 && totalDmg > 0) {
        const heal = Math.floor(totalDmg * lifestealPct);
        session.hp = Math.min(session.maxHp, session.hp + heal);
        log.push(`🩸 흡혈: +${heal} HP`);
    }
    // 파티 힐
    if (skills.healRatio > 0) {
        const heal = Math.floor(session.maxHp * skills.healRatio);
        session.hp = Math.min(session.maxHp, session.hp + heal);
        log.push(`💚 힐: +${heal} HP`);
    }

    if (session.bossHp <= 0) return { log, result: 'win' };

    // 보스 광폭화 확인
    const enrageThreshold = Math.floor(boss.maxHp * boss.enrageHp);
    if (session.bossHp <= enrageThreshold && !session.enraged) {
        session.enraged = true;
        log.push(`💢 [광폭화!!] ${boss.name} 이(가) 분노했습니다! 공격력 ×${boss.enrageAtkMult}`);
    }

    // 보스 회복 시도 (패턴 방해 성공 시 차단)
    if (!blockHeal && session.bossHp < boss.maxHp * 0.4 && Math.random() < 0.08) {
        const bossHeal = Math.floor(boss.maxHp * 0.05);
        session.bossHp = Math.min(boss.maxHp, session.bossHp + bossHeal);
        log.push(`💉 보스 회복: +${bossHeal} HP`);
    } else if (blockHeal) {
        log.push(`🚫 방해 성공! 보스 회복 차단`);
    }

    // 보스 공격 (회피 패턴 대응 성공 시 완전 회피)
    const isFrozen = session.bossDebuffs.some(d => d.type === 'freeze');
    const slowPct  = session.bossDebuffs.filter(d => d.type === 'slow').reduce((s,d) => s+d.value, 0) / 100;
    if (isFrozen) {
        log.push(`❄️ 빙결! 보스의 공격이 봉인되었습니다.`);
    } else if (forceEvade) {
        log.push(`💨 완전 회피 성공!`);
    } else if (dodgePct > 0 && Math.random() * 100 < dodgePct) {
        log.push(`💨 회피 성공!`);
    } else {
        const bossAtk = Math.floor(boss.atk * (session.enraged ? boss.enrageAtkMult : 1) * (1 - slowPct));
        const damageReduction = guardPct + (1 - 1 / Math.max(1, skills.defMult));
        let bossDmg = Math.max(1, Math.floor(bossAtk * bossDmgMult * (1 - Math.min(0.8, damageReduction))));
        // 방어 자세
        if (action === '방어') { bossDmg = Math.floor(bossDmg * 0.6); log.push(`🛡️ 방어 자세: 피해 40% 감소`); }
        // 배리어
        if (session.playerBarrier > 0) { bossDmg = Math.floor(bossDmg * 0.5); log.push(`✨ 배리어: 피해 50% 감소`); }
        session.hp -= bossDmg;
        log.push(`👹 보스: ${bossDmg} 피해`);
        // 반격(가시)
        if (thornsPct > 0) {
            const thorns = Math.floor(bossAtk * thornsPct);
            session.bossHp = Math.max(0, session.bossHp - thorns);
            log.push(`🌵 반격: 보스에게 ${thorns} 피해`);
            if (session.bossHp <= 0) return { log, result: 'win' };
        }
    }

    if (session.hp <= 0) return { log, result: 'lose' };

    // 다음 턴 보스 패턴 예고 (25% 확률)
    if (Math.random() < 0.35) {
        session.pendingPattern = rollBossPattern();
        log.push(`\n⚠️ 예고: ${session.pendingPattern.announce}`);
    }

    return { log, result: 'continue' };
}

// ─────────────────────────────────────────────
// Phase 5: 스킬북 시스템
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 마력(MP) + 마법 시스템
// ─────────────────────────────────────────────
// 마법서 목록 — 10개 모이면 자동으로 다음 단계로 합성
const MAGIC_BOOKS = [
    // ── 화염 계열 ──────────────────────────────────────
    { id: 'fireball',     name: '파이어볼',     tier: 1, element: '🔥', mana: 5,   dmgMult: 1.4, effect: null,          evolves: 'flame_burst',    desc: '화염 구체를 발사한다.', cost: { souls: 3,  gold: 200000 } },
    { id: 'flame_burst',  name: '플레임 버스트', tier: 2, element: '🔥', mana: 12,  dmgMult: 1.9, effect: 'burn',        evolves: 'inferno',        desc: '화염이 폭발하며 화상을 입힌다. (2턴 추가 피해)', cost: { souls: 10, gold: 1000000 } },
    { id: 'inferno',      name: '인페르노',      tier: 3, element: '🔥', mana: 25,  dmgMult: 3.0, effect: 'burn_heavy',  evolves: 'meteor',         desc: '대규모 화염 폭풍. 3턴간 강한 화상.', cost: { souls: 30, gold: 5000000 } },
    { id: 'meteor',       name: '메테오',        tier: 4, element: '🔥', mana: 50,  dmgMult: 5.0, effect: 'stun',        evolves: null,             desc: '하늘에서 운석을 소환. 기절 30%.', cost: { souls: 80, gold: 20000000 } },
    // ── 냉기 계열 ──────────────────────────────────────
    { id: 'ice_shard',    name: '아이스 샤드',   tier: 1, element: '❄️', mana: 5,   dmgMult: 1.3, effect: 'slow',        evolves: 'blizzard',       desc: '얼음 파편으로 적의 속도를 낮춘다. (보스 공격력 -10%)', cost: { souls: 3,  gold: 200000 } },
    { id: 'blizzard',     name: '블리자드',      tier: 2, element: '❄️', mana: 15,  dmgMult: 2.2, effect: 'freeze',      evolves: 'glacial_spike',  desc: '눈보라로 1턴 적을 얼린다. (다음 턴 보스 피해 무효)', cost: { souls: 12, gold: 1500000 } },
    { id: 'glacial_spike',name: '글라시얼 스파이크', tier: 3, element: '❄️', mana: 30, dmgMult: 3.5, effect: 'freeze_heavy', evolves: 'absolute_zero', desc: '거대한 얼음 기둥으로 관통. 방어 무시.', cost: { souls: 40, gold: 8000000 } },
    { id: 'absolute_zero',name: '절대영도',      tier: 4, element: '❄️', mana: 60,  dmgMult: 6.0, effect: 'full_freeze',  evolves: null,            desc: '모든 것을 얼린다. 2턴간 보스 공격 봉인.', cost: { souls: 100, gold: 40000000 } },
    // ── 번개 계열 ──────────────────────────────────────
    { id: 'lightning',    name: '라이트닝',      tier: 1, element: '⚡', mana: 6,   dmgMult: 1.5, effect: null,          evolves: 'chain_lightning',desc: '번개를 발사한다.', cost: { souls: 3,  gold: 200000 } },
    { id: 'chain_lightning',name: '체인 라이트닝', tier: 2, element: '⚡', mana: 14, dmgMult: 2.0, effect: 'chain',       evolves: 'thunder_god',    desc: '번개가 연쇄 타격. 피해 1.2배 추가.', cost: { souls: 12, gold: 1500000 } },
    { id: 'thunder_god',  name: '뇌신',          tier: 3, element: '⚡', mana: 28,  dmgMult: 3.8, effect: 'electrify',   evolves: 'judgment_bolt',  desc: '뇌신의 힘으로 강타. 3턴간 방어력 무시.', cost: { souls: 45, gold: 9000000 } },
    { id: 'judgment_bolt',name: '심판의 벼락',   tier: 4, element: '⚡', mana: 55,  dmgMult: 5.5, effect: 'stun_heavy',  evolves: null,             desc: '하늘의 심판. 50% 확률 2턴 기절.', cost: { souls: 90, gold: 35000000 } },
    // ── 어둠 계열 ──────────────────────────────────────
    { id: 'shadow_bolt',  name: '쉐도우 볼트',   tier: 1, element: '🌑', mana: 7,   dmgMult: 1.6, effect: 'curse',       evolves: 'dark_nova',      desc: '어둠의 에너지. 저주로 보스 방어 -15%.', cost: { souls: 4,  gold: 300000 } },
    { id: 'dark_nova',    name: '다크 노바',      tier: 2, element: '🌑', mana: 18,  dmgMult: 2.5, effect: 'curse_heavy', evolves: 'void_rift',      desc: '어둠이 폭발. 보스 방어 -30%.', cost: { souls: 15, gold: 2000000 } },
    { id: 'void_rift',    name: '공허의 균열',   tier: 3, element: '🌑', mana: 35,  dmgMult: 4.2, effect: 'void',        evolves: 'annihilation',   desc: '공허를 열어 적을 빨아들인다. 방어 완전 무시.', cost: { souls: 60, gold: 15000000 } },
    { id: 'annihilation', name: '소멸',           tier: 4, element: '🌑', mana: 70,  dmgMult: 7.0, effect: 'doom',        evolves: null,             desc: '존재 자체를 지운다. 현재 보스 HP의 15% 추가.', cost: { souls: 120, gold: 60000000 } },
    // ── 신성 계열 ──────────────────────────────────────
    { id: 'holy_light',   name: '홀리 라이트',   tier: 1, element: '✨', mana: 6,   dmgMult: 1.2, effect: 'heal_self',   evolves: 'divine_wrath',   desc: '신성한 빛으로 자신을 치유. +15% HP.', cost: { souls: 4,  gold: 300000 } },
    { id: 'divine_wrath', name: '신성한 분노',   tier: 2, element: '✨', mana: 16,  dmgMult: 2.3, effect: 'smite',       evolves: 'archangel',      desc: '신의 분노로 타격. 크리티컬 50% 보장.', cost: { souls: 18, gold: 3000000 } },
    { id: 'archangel',    name: '대천사',         tier: 3, element: '✨', mana: 38,  dmgMult: 4.0, effect: 'barrier',     evolves: 'divine_judgment',desc: '대천사 강림. 다음 2턴 피해 50% 방어.', cost: { souls: 70, gold: 18000000 } },
    { id: 'divine_judgment',name: '신의 심판',  tier: 4, element: '✨', mana: 65,  dmgMult: 6.5, effect: 'holy_full',   evolves: null,             desc: '신의 심판. 광폭화한 보스에게 피해 2배.', cost: { souls: 110, gold: 50000000 } },
];

const MAGIC_EVOLUTION_CHAIN = {}; // id → evolves
for (const m of MAGIC_BOOKS) {
    if (m.evolves) MAGIC_EVOLUTION_CHAIN[m.id] = m.evolves;
}

function getMagicBook(id) { return MAGIC_BOOKS.find(m => m.id === id) || null; }

// 마력(MP) 장비 옵션 합산
function calcManaFromEquip(equipment) {
    let mana = 0, regen = 0;
    for (const slot of ['weapon','armor','shield','ring1','ring2']) {
        const it = equipment && equipment[slot];
        if (!it || it.broken) continue;
        if (it.effect && it.effect.id === 'mana') mana += it.effect.value || 0;
        if (it.effect && it.effect.id === 'manaRegen') regen += it.effect.value || 0;
    }
    return { mana: Math.round(mana), regen: Math.round(regen) };
}

// 최대 마력 계산 (기본 20 + 스킬/장비 보너스)
function calcMaxMana(user) {
    const BASE_MANA = 20;
    const { mana } = calcManaFromEquip(user.equipment);
    const skillMana = (user.skills || []).reduce((s, sk) => {
        const b = MAGIC_BOOKS.find(m => m.id === sk); // 마법 id를 skills에 저장
        return s; // 마법은 spells 배열에 별도 저장
    }, 0);
    return BASE_MANA + mana;
}

// 마법 효과 적용 (레이드 턴 내)
function applyMagicEffect(spell, session, log) {
    if (!spell.effect) return;
    switch (spell.effect) {
        case 'burn':       session.bossDebuffs.push({ type: 'burn', turns: 2, value: 5 });  log.push('🔥 화상 상태 (2턴)'); break;
        case 'burn_heavy': session.bossDebuffs.push({ type: 'burn', turns: 3, value: 12 }); log.push('🔥🔥 강화 화상 (3턴)'); break;
        case 'slow':       session.bossDebuffs.push({ type: 'slow', turns: 2, value: 10 }); log.push('❄️ 감속 (2턴, 보스 공격력 -10%)'); break;
        case 'freeze':     session.bossDebuffs.push({ type: 'freeze', turns: 1, value: 0 }); log.push('❄️ 빙결 (1턴 공격 봉인)'); break;
        case 'freeze_heavy': session.bossDebuffs.push({ type: 'freeze', turns: 2, value: 0 }); log.push('❄️❄️ 강화 빙결 (2턴 공격 봉인)'); break;
        case 'full_freeze':  session.bossDebuffs.push({ type: 'freeze', turns: 2, value: 0 }); log.push('❄️ 절대 빙결 (2턴 완전 봉인)'); break;
        case 'chain':      log.push('⚡ 연쇄 번개 추가 타격'); break;
        case 'electrify':  session.bossDebuffs.push({ type: 'electrify', turns: 3, value: 1 }); log.push('⚡ 감전 (3턴 방어 무시)'); break;
        case 'stun':       if (Math.random() < 0.3) { session.bossDebuffs.push({ type: 'freeze', turns: 1, value: 0 }); log.push('💫 기절!'); } break;
        case 'stun_heavy': if (Math.random() < 0.5) { session.bossDebuffs.push({ type: 'freeze', turns: 2, value: 0 }); log.push('💫💫 강화 기절 (2턴)!'); } break;
        case 'curse':      session.bossDebuffs.push({ type: 'defDown', turns: 2, value: 15 }); log.push('🌑 저주 (방어력 -15%, 2턴)'); break;
        case 'curse_heavy':session.bossDebuffs.push({ type: 'defDown', turns: 3, value: 30 }); log.push('🌑🌑 강화 저주 (방어력 -30%, 3턴)'); break;
        case 'void':       session.bossDebuffs.push({ type: 'pierce100', turns: 2, value: 0 }); log.push('🌑 공허 (2턴 방어 완전 무시)'); break;
        case 'doom':       break; // dmgMult에 추가 처리
        case 'heal_self':  { const h = Math.floor(session.maxHp * 0.15); session.hp = Math.min(session.maxHp, session.hp + h); log.push(`✨ 치유: +${h} HP`); break; }
        case 'smite':      session.nextCritGuaranteed = true; log.push('✨ 다음 공격 크리티컬 보장'); break;
        case 'barrier':    session.playerBarrier = 2; log.push('✨ 방어 장벽 (2턴 피해 50% 감소)'); break;
        case 'holy_full':  if (session.enraged) { log.push('✨ 광폭화 대상 → 피해 2배 적용!'); } break;
    }
}

// debuff 틱 처리
function tickBossDebuffs(session, log) {
    if (!session.bossDebuffs) session.bossDebuffs = [];
    const keep = [];
    for (const d of session.bossDebuffs) {
        d.turns--;
        if (d.type === 'burn') {
            const tick = Math.floor(session.boss.maxHp * d.value / 100);
            session.bossHp = Math.max(0, session.bossHp - tick);
            log.push(`🔥 화상 피해: ${tick}`);
        }
        if (d.turns > 0) keep.push(d);
    }
    session.bossDebuffs = keep;
}

// 마법 합성 체크 — spells 배열에서 id가 10개 이상이면 evolve
function checkMagicEvolution(user) {
    const msgs = [];
    for (const [baseId, evolveId] of Object.entries(MAGIC_EVOLUTION_CHAIN)) {
        const count = (user.spells || []).filter(id => id === baseId).length;
        if (count >= 10) {
            const removeCount = Math.floor(count / 10) * 10;
            let removed = 0;
            user.spells = (user.spells || []).filter(id => {
                if (id === baseId && removed < removeCount) { removed++; return false; }
                return true;
            });
            const gained = Math.floor(count / 10);
            for (let i = 0; i < gained; i++) user.spells.push(evolveId);
            const base = getMagicBook(baseId);
            const next = getMagicBook(evolveId);
            if (base && next) msgs.push(`🌟 합성! ${base.name} × ${removeCount} → ${next.name} × ${gained}`);
        }
    }
    return msgs;
}

const SKILL_BOOKS = {
    // 공격계열
    'A급 검술':         { grade: '고급', type: 'passive', stat: 'atk', value: 10, desc: '기본 공격력 +10 (영구)', cost: { souls: 5,  gold: 500000 } },
    'S급 검술':         { grade: '영웅', type: 'passive', stat: 'atk', value: 25, desc: '기본 공격력 +25 (영구)', cost: { souls: 15, gold: 3000000 } },
    'SS급 검술':        { grade: '전설', type: 'passive', stat: 'atk', value: 60, desc: '기본 공격력 +60 (영구)', cost: { souls: 40, gold: 20000000 } },
    // 방어계열
    'A급 방어술':       { grade: '고급', type: 'passive', stat: 'def', value: 8,  desc: '기본 방어력 +8 (영구)',  cost: { souls: 5,  gold: 500000 } },
    'S급 방어술':       { grade: '영웅', type: 'passive', stat: 'def', value: 20, desc: '기본 방어력 +20 (영구)', cost: { souls: 15, gold: 3000000 } },
    'SS급 방어술':      { grade: '전설', type: 'passive', stat: 'def', value: 50, desc: '기본 방어력 +50 (영구)', cost: { souls: 40, gold: 20000000 } },
    // 체력계열
    'A급 강인함':       { grade: '고급', type: 'passive', stat: 'hp',  value: 100,desc: '기본 HP +100 (영구)',   cost: { souls: 5,  gold: 500000 } },
    'S급 강인함':       { grade: '영웅', type: 'passive', stat: 'hp',  value: 250,desc: '기본 HP +250 (영구)',   cost: { souls: 15, gold: 3000000 } },
    'SS급 강인함':      { grade: '전설', type: 'passive', stat: 'hp',  value: 600,desc: '기본 HP +600 (영구)',   cost: { souls: 40, gold: 20000000 } },
    // 전투 특수
    '연속타':           { grade: '영웅', type: 'combat', effect: 'extraHit', value: 15, desc: '전투 중 15% 확률로 추가 공격', cost: { souls: 20, gold: 5000000 } },
    '강철 의지':        { grade: '전설', type: 'combat', effect: 'lastStand', value: 30, desc: 'HP 20% 이하 시 공격력 +30%', cost: { souls: 60, gold: 30000000 } },
    '용의 피':          { grade: '신화', type: 'combat', effect: 'dragonBlood', value: 50, desc: '매 턴 최대HP 2% 회복 + 공격력 +50', cost: { souls: 150, gold: 200000000 } },
    '진명해방 각성':    { grade: '태초', type: 'combat', effect: 'ultimateAwaken', value: 100, desc: '진명해방 스킬 효과 2배', cost: { souls: 500, gold: 2000000000 } },
};

const SKILL_GRADE_ORDER = ['고급','영웅','전설','신화','태초'];

// 스킬 패시브 스탯 합산
function calcSkillStat(skills) {
    let atk = 0, def = 0, hp = 0;
    for (const skillName of (skills || [])) {
        const sk = SKILL_BOOKS[skillName];
        if (!sk || sk.type !== 'passive') continue;
        if (sk.stat === 'atk') atk += sk.value;
        else if (sk.stat === 'def') def += sk.value;
        else if (sk.stat === 'hp') hp += sk.value;
    }
    return { atk, def, hp };
}

// ─────────────────────────────────────────────
// Phase 6: 시즌 시스템
// ─────────────────────────────────────────────
const SEASON_CONFIG = {
    name: '시즌 1: 태초의 균열',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    rewards: [
        { rank: 1, gold: 500000000, stones: 500, souls: 100, title: '🏆[시즌 챔피언]' },
        { rank: 2, gold: 200000000, stones: 300, souls: 60,  title: '🥈[준우승]' },
        { rank: 3, gold: 100000000, stones: 200, souls: 40,  title: '🥉[3위]' },
        { rank: 10, gold: 30000000, stones: 80,  souls: 15,  title: '⭐[시즌 TOP10]' },
    ]
};

// 가챠 아이템 풀 (등급별)
const GACHA_ITEM_POOL = {
    꽝: [
        { name: '빈봉투', type: 'nothing', value: 0, desc: '아무것도 없습니다...' }
    ],
    일반: [
        { name: '소액현금권', type: 'cash', value: 10000, desc: '즉시 1만P 지급' },
        { name: '섯다 부적(하)', type: 'sutda_hint', value: 1, desc: '섯다 족보 힌트 (낮은 정확도)' },
        { name: '숫자 감지기(하)', type: 'numguess_hint', value: 1, desc: '숫자맞추기 오답 1개 제거' },
        { name: '바카라 코인(하)', type: 'baccarat_boost', value: 2, desc: '바카라 배당 +2%' }
    ],
    희귀: [
        { name: '중액현금권', type: 'cash', value: 100000, desc: '즉시 10만P 지급' },
        { name: '섯다 부적(중)', type: 'sutda_hint', value: 3, desc: '섯다 족보 힌트 (중간 정확도)' },
        { name: '패교체권(1회)', type: 'card_change', value: 1, desc: '섯다 패 교체 1회 사용 가능' },
        { name: '블랙잭 보험', type: 'bj_insurance', value: 1, desc: '블랙잭 버스트 시 배팅액 50% 환급' },
        { name: '숫자 감지기(중)', type: 'numguess_hint', value: 2, desc: '숫자맞추기 오답 2개 제거' }
    ],
    영웅: [
        { name: '고액현금권', type: 'cash', value: 1000000, desc: '즉시 100만P 지급' },
        { name: '패교체권(2회)', type: 'card_change', value: 2, desc: '섯다 패 교체 2회 사용 가능' },
        { name: '딜러봉인권', type: 'dealer_seal', value: 1, desc: '섯다 딜러 다이 확률 0%로 고정(1판)' },
        { name: '블랙잭 투시경', type: 'bj_peek', value: 1, desc: '블랙잭 딜러 숨긴 패 공개' },
        { name: '바카라 코인(상)', type: 'baccarat_boost', value: 8, desc: '바카라 배당 +8%' },
        { name: '주사위 조작기(하)', type: 'dice_boost', value: 5, desc: '1:1주사위 유리한 눈 확률 +5%' }
    ],
    전설: [
        { name: '전설현금권', type: 'cash', value: 10000000, desc: '즉시 1000만P 지급' },
        { name: '광땡설계도(소)', type: 'gwangddaeng', value: 3, desc: '섯다 시작 시 광땡 확률 +3%' },
        { name: '블랙잭 신의손', type: 'bj_divine', value: 1, desc: '블랙잭 첫패 블랙잭 확률 +10%' },
        { name: '수수료면제권', type: 'fee_waive', value: 1, desc: '다음 게임 수수료 면제(1회)' },
        { name: '주사위 조작기(상)', type: 'dice_boost', value: 15, desc: '1:1주사위 유리한 눈 확률 +15%' }
    ],
    신화: [
        { name: '신화현금권', type: 'cash', value: 100000000, desc: '즉시 1억P 지급' },
        { name: '광땡설계도(대)', type: 'gwangddaeng', value: 10, desc: '섯다 시작 시 광땡 확률 +10%' },
        { name: '타짜의 신 증명서', type: 'sutda_god', value: 1, desc: '섯다 승리 시 수수료 면제 + 패교체 3회' },
        { name: '신화반지', type: 'gacha_boost', value: 10, desc: '랜덤상자 개봉 시 등급 확률 10% 상향' },
        { name: '전지전능권', type: 'omniscient', value: 1, desc: '모든 게임 수수료 면제 + 모든 버프 적용(1판)' }
    ]
};

// 섯다 덱
const DECK = [
    { m: 1, name: '1광' }, { m: 1, name: '1피' }, { m: 2, name: '2열' }, { m: 2, name: '2피' },
    { m: 3, name: '3광' }, { m: 3, name: '3피' }, { m: 4, name: '4열' }, { m: 4, name: '4피' },
    { m: 5, name: '5열' }, { m: 5, name: '5피' }, { m: 6, name: '6열' }, { m: 6, name: '6피' },
    { m: 7, name: '7열' }, { m: 7, name: '7피' }, { m: 8, name: '8광' }, { m: 8, name: '8열' },
    { m: 9, name: '9열' }, { m: 9, name: '9피' }, { m: 10, name: '10열' }, { m: 10, name: '10피' }
];

// 퀴즈
const QUIZZES = [
    { q: '세상에서 가장 가난한 왕은?', a: '최저임금' },
    { q: '차가 울면 무엇일까요?', a: '카잉' },
    { q: '오리가 얼면 무엇이 될까요?', a: '언덕' },
    { q: '영화 타짜에서 아귀가 밑장빼기 하려다 걸린 화투 패는?', a: '단풍' },
    { q: '조선시대 백성들을 위해 훈민정음을 창제하신 임금은?', a: '세종대왕' }
];

// 코인 뉴스 (진짜/가짜 포함)
const NEWS_POOL = {
    '성빈코인': {
        up_real:   ['📰 [속보] 성빈코인 재단, 글로벌 거래소 상장 확정!', '📰 [호재] 기관 투자자 대규모 매집 포착!'],
        up_fake:   ['📰 [찌라시] 성빈코인 화성 이주지 화폐 채택 루머 확산...'],
        down_real: ['📰 [경보] 개발자 지갑 대규모 이동 포착! 투매 우려', '📰 [속보] 정부 규제 조사 착수'],
        down_fake: ['📰 [루머] 성빈코인 해킹 피해 제보...사실 여부 불명확']
    },
    '호근코인': {
        up_real:   ['📰 [호재] 호근코인 ETF 승인 완료', '📰 [뉴스] 고래들 물량 락업 계약 체결'],
        up_fake:   ['📰 [찌라시] 워렌버핏이 호근코인 매집?...확인 불가'],
        down_real: ['📰 [경보] 블록체인 오류 발생 마비', '📰 [악재] 대주주 세금 체납 지분 청산'],
        down_fake: ['📰 [루머] 호근코인 내부 분열설...공식 부인']
    },
    '정재코인': {
        up_real:   ['📰 [속보] 정재코인 결제 시스템 도입 확정!', '📰 [호재] 글로벌 파트너십 체결'],
        up_fake:   ['📰 [찌라시] 정재코인 대기업 인수설 돌아...'],
        down_real: ['📰 [🚨상폐] 상장폐지 실질심사 대상 지정!', '📰 [악재] 커뮤니티 해킹 신뢰도 추락'],
        down_fake: ['📰 [루머] 정재코인 개발자 먹튀설...진위 불명']
    },
    '몰탈코인': {
        up_real:   ['📰 [속보] 몰탈코인 정체불명 고래 대규모 매집!', '📰 [호재] 글로벌 상장 발표'],
        up_fake:   ['📰 [찌라시] 몰탈코인 유명인 보유 루머...'],
        down_real: ['📰 [경보] 공식 텔레그램 폐쇄 먹튀 의혹', '📰 [속보] 핵심 개발자 잠적'],
        down_fake: ['📰 [루머] 몰탈코인 경쟁사 공격설...확인중']
    },
    '펭즈코인': {
        up_real:   ['📰 [화제] 인플루언서 언급에 거래량 폭증!', '📰 [호재] 밈 챌린지 전세계 확산'],
        up_fake:   ['📰 [찌라시] 펭즈코인 유명 연예인 투자설...'],
        down_real: ['📰 [뉴스] 밈 유행 시들 거래량 급감', '📰 [경보] 커뮤니티 분열 신뢰도 하락'],
        down_fake: ['📰 [루머] 펭즈코인 가짜 거래량 의혹...조사중']
    },
    '첨지코인': {
        up_real:   ['📰 [찌라시] 큰손 매수세 집중!', '📰 [속보] 기관 자금 유입 포착'],
        up_fake:   ['📰 [루머] 첨지코인 정부 채택설...사실무근?'],
        down_real: ['📰 [경보] 큰손 물량 이탈 시장 동요', '📰 [악재] 규제 검토 매도 압력'],
        down_fake: ['📰 [찌라시] 첨지코인 내부자 대량 매도설...미확인']
    }
};

// 업적 정의 (게임별 레벨업형)
const ACHIEVEMENTS = {
    sutda: [
        { level: 1, wins: 10,   title: '초보 타짜',     display: (n) => `[초보 타짜] ${n}` },
        { level: 2, wins: 50,   title: '타짜',           display: (n) => `⚡[타짜] ${n}` },
        { level: 3, wins: 200,  title: '베테랑 타짜',   display: (n) => `🔥[베테랑 타짜] ${n}` },
        { level: 4, wins: 500,  title: '전설의 타짜',   display: (n) => `💫✨[전설의 타짜]✨💫 ${n}` },
        { level: 5, wins: 1000, title: '타짜의 신',     display: (n) => `👑🎴⚡[타짜의 신]⚡🎴👑 ${n}` }
    ],
    blackjack: [
        { level: 1, wins: 10,   title: '블랙잭 입문자',  display: (n) => `[블랙잭 입문자] ${n}` },
        { level: 2, wins: 50,   title: '카드 카운터',    display: (n) => `🃏[카드 카운터] ${n}` },
        { level: 3, wins: 200,  title: '블랙잭 고수',    display: (n) => `🎯🃏[블랙잭 고수] ${n}` },
        { level: 4, wins: 500,  title: '카지노의 왕',    display: (n) => `👑🃏✨[카지노의 왕]✨🃏👑 ${n}` },
        { level: 5, wins: 1000, title: '블랙잭의 신',    display: (n) => `🌟👑🎴[블랙잭의 신]🎴👑🌟 ${n}` }
    ],
    baccarat: [
        { level: 1, wins: 10,   title: '바카라 입문자',  display: (n) => `[바카라 입문자] ${n}` },
        { level: 2, wins: 50,   title: '배팅 전문가',    display: (n) => `💰[배팅 전문가] ${n}` },
        { level: 3, wins: 200,  title: '바카라 고수',    display: (n) => `💎💰[바카라 고수] ${n}` },
        { level: 4, wins: 500,  title: '마카오의 전설',  display: (n) => `🎰💎✨[마카오의 전설]✨💎🎰 ${n}` },
        { level: 5, wins: 1000, title: '바카라의 신',    display: (n) => `👑🎰🌟[바카라의 신]🌟🎰👑 ${n}` }
    ],
    numberGuess: [
        { level: 1, wins: 10,   title: '수비학 입문자',  display: (n) => `[수비학 입문자] ${n}` },
        { level: 2, wins: 50,   title: '숫자 감각자',    display: (n) => `🔢[숫자 감각자] ${n}` },
        { level: 3, wins: 200,  title: '수비학 고수',    display: (n) => `🎯🔢[수비학 고수] ${n}` },
        { level: 4, wins: 500,  title: '예언자',         display: (n) => `🔮🎯✨[예언자]✨🎯🔮 ${n}` },
        { level: 5, wins: 1000, title: '수비학의 신',    display: (n) => `👑🔮🌟[수비학의 신]🌟🔮👑 ${n}` }
    ],
    duel: [
        { level: 1, wins: 10,   title: '주사위 초보',    display: (n) => `[주사위 초보] ${n}` },
        { level: 2, wins: 50,   title: '주사위 도박사',  display: (n) => `🎲[주사위 도박사] ${n}` },
        { level: 3, wins: 200,  title: '주사위 고수',    display: (n) => `⚡🎲[주사위 고수] ${n}` },
        { level: 4, wins: 500,  title: '운명을 건 자',   display: (n) => `🌀🎲✨[운명을 건 자]✨🎲🌀 ${n}` },
        { level: 5, wins: 1000, title: '주사위의 신',    display: (n) => `👑🎲🌟[주사위의 신]🌟🎲👑 ${n}` }
    ]
};

// ─────────────────────────────────────────────
// 특수 타이틀 (RPG 진행/컬렉션/부/전설 계열)
// !내정보에서 최고 등급 5개까지 함께 표시
// 각 함수는 user 객체 받아 조건 만족 시 타이틀 문자열 반환, 아니면 null
// ─────────────────────────────────────────────
const SPECIAL_TITLES = [
    // 최종보스 (최고 우선순위)
    { id: 'finalBoss', priority: 100, check: (u) => (u.bossKills && u.bossKills['혼돈의 지배자'] > 0) ? '🌟👑💫[혼돈을 정복한 자]💫👑🌟' : null },
    
    // RPG 진행 계열
    { id: 'boss10',   priority: 90, check: (u) => (u.bossKills && Object.keys(u.bossKills).length >= 10) ? '👑⚔️[대륙의 영웅]' : null },
    { id: 'boss5',    priority: 80, check: (u) => (u.bossKills && Object.keys(u.bossKills).length >= 5) ? '🛡️⚔️[정예 모험가]' : null },
    { id: 'boss1',    priority: 60, check: (u) => (u.bossKills && Object.keys(u.bossKills).length >= 1) ? '⚔️[모험가]' : null },
    
    // 사냥 계열
    { id: 'hunt1000', priority: 75, check: (u) => (u.huntWins || 0) >= 1000 ? '🎯🏹[사냥의 달인]' : null },
    { id: 'hunt100',  priority: 55, check: (u) => (u.huntWins || 0) >= 100 ? '🏹[숙련된 사냥꾼]' : null },
    { id: 'hunt1',    priority: 35, check: (u) => (u.huntWins || 0) >= 1 ? '🌱[초보 사냥꾼]' : null },
    
    // 컬렉션 계열
    { id: 'primordial', priority: 85, check: (u) => {
        for (const [n, p] of Object.entries(u.partyMembers || {})) {
            if (PARTY_MEMBERS[n]?.grade === '태초' && ((p.count||0) + (p.level||0) > 0)) return '✨[태초의 목격자]';
        }
        return null;
    }},
    { id: 'collector', priority: 65, check: (u) => {
        const grades = new Set();
        for (const [n, p] of Object.entries(u.partyMembers || {})) {
            if ((p.count||0) + (p.level||0) > 0 && PARTY_MEMBERS[n]) grades.add(PARTY_MEMBERS[n].grade);
        }
        return grades.size >= 7 ? '🎭[모든 등급 수집가]' : null;
    }},
    
    // 부의 상징
    { id: 'ultraRich', priority: 95, check: (u) => {
        const nw = calcNetWorth(u);
        return nw.total >= 10000000000000000 ? '💰💰💰[경제 지배자]' : null; // 1경
    }},
    { id: 'megaRich', priority: 70, check: (u) => {
        const nw = calcNetWorth(u);
        return nw.total >= 100000000000000 ? '💰💰[초대형 재벌]' : null; // 100조
    }},
    { id: 'rich', priority: 50, check: (u) => {
        const nw = calcNetWorth(u);
        return nw.total >= 1000000000000 ? '💰[재벌]' : null; // 1조
    }},
];

// 유저가 획득한 특수 타이틀 목록 (우선순위 정렬)
function getEarnedTitles(user) {
    const earned = [];
    for (const t of SPECIAL_TITLES) {
        const title = t.check(user);
        if (title) earned.push({ id: t.id, priority: t.priority, title });
    }
    earned.sort((a, b) => b.priority - a.priority);
    return earned;
}

// ═══════════════════════════════════════════════════════
// 3. 런타임 상태
// ═══════════════════════════════════════════════════════
let LUXURY_MARKET = {}; // 레거시 (빈 객체로 유지, 삭제 후 하위 참조 안전)
let COIN_MARKET = {};
const gameSessions = {};      // 섯다
const blackjackSessions = {}; // 블랙잭
const baccaratSessions = {};  // 바카라
const numberGuessSessions = {};// 숫자맞추기
const duelSessions = {};      // 1:1 주사위
let currentQuiz = null;
let quizTimer = null;
let activeNewsRooms = [];     // 뉴스 활성화된 방 목록

// ═══════════════════════════════════════════════════════
// 4. 저장/로드
// ═══════════════════════════════════════════════════════
function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
        console.error('users.json 로드 실패:', e.message);
        return {};
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('users.json 저장 실패:', e.message);
    }
}

const MIN_BALANCE = 2000;
// 잔액이 MIN_BALANCE 이하면 자동 충전. 충전 시 메시지 반환(없으면 null).
function checkMinBalance(user) {
    if (user.points < MIN_BALANCE) {
        const added = MIN_BALANCE - user.points;
        user.points = MIN_BALANCE;
        return `💸 잔액 부족 — 최소 보장금 ${added.toLocaleString()}원이 지급되었습니다. (잔액: ${formatKRW(MIN_BALANCE)})`;
    }
    return null;
}


function loadMarket() {
    try {
        if (fs.existsSync(MARKET_FILE)) {
            const data = JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8'));
            LUXURY_MARKET = {}; // 사치품 제거됨
            COIN_MARKET = data.coin || {};
            for (const [k, v] of Object.entries(DEFAULT_COIN)) {
                if (!COIN_MARKET[k]) COIN_MARKET[k] = JSON.parse(JSON.stringify(v));
            }
            saveMarket();
            return;
        }
    } catch (e) {
        console.error('market.json 로드 실패:', e.message);
    }
    LUXURY_MARKET = {};
    COIN_MARKET = JSON.parse(JSON.stringify(DEFAULT_COIN));
    saveMarket();
}

function saveMarket() {
    try {
        fs.writeFileSync(MARKET_FILE, JSON.stringify({ luxury: LUXURY_MARKET, coin: COIN_MARKET }, null, 2), 'utf8');
    } catch (e) {
        console.error('market.json 저장 실패:', e.message);
    }
}

// ═══════════════════════════════════════════════════════
// 5. 유저 정규화
// ═══════════════════════════════════════════════════════
function createDefaultUser() {
    return {
        points: 2000,        // 골드 (기존 points 유지)
        stones: 0,           // 강화석 (사냥터에서만 획득)
        souls: 0,            // 소울 (8단계 이상 레이드 확률 획득)
        lastCheckIn: '',
        items: [],
        coins: {},
        gachaItems: [],
        boxes: {},
        loan: { amount: 0, takenAt: 0 },
        deposit: { amount: 0, depositedAt: 0 },
        seized: false,
        // === RPG ===
        partyMembers: {},    // { '김판돌': { count: N, level: N } } — 10명 모으면 +1강화
        activeParty: [],     // 편성된 파티원 이름 배열 (최대 3)
        equipment: { weapon: null, armor: null, shield: null, ring1: null, ring2: null },
        equipmentInventory: [], // 보유 장비 (미장착) 목록
        skills: [],          // 학습한 스킬 목록
        spells: [],          // 보유 마법 ID 목록 (중복 허용, 10개 합성)
        mana: 20,            // 현재 마력 (레이드 시작 시 maxMana로 충전)
        huntCount: 0,        // 사냥 횟수
        huntWins: 0,         // 사냥 성공
        bossKills: {},       // { '킹슬라임': N, ... } 보스별 처치 횟수
        lastRaidAt: 0,       // 마지막 레이드 시작 시각 (쿨타임)
        firstBossClears: {}, // 최초 클리어 기록
        lastHuntAt: 0,       // 마지막 사냥 시각 (쿨타임)
        lastRaidAt: 0,       // 마지막 레이드 시각
        // === 통계 ===
        stats: {
            sutda:       { wins: 0, losses: 0, draws: 0 },
            blackjack:   { wins: 0, losses: 0 },
            baccarat:    { wins: 0, losses: 0 },
            numberGuess: { wins: 0, losses: 0 },
            duel:        { wins: 0, losses: 0 }
        }
    };
}

function normalizeHolding(raw) {
    if (typeof raw === 'number') return raw > 0 ? { count: raw, avgPrice: 0 } : { count: 0, avgPrice: 0 };
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return {
            count: (typeof raw.count === 'number' && !isNaN(raw.count)) ? raw.count : 0,
            avgPrice: (typeof raw.avgPrice === 'number' && !isNaN(raw.avgPrice)) ? raw.avgPrice : 0
        };
    }
    return { count: 0, avgPrice: 0 };
}

function ensureUser(db, name) {
    let u = Object.prototype.hasOwnProperty.call(db, name) ? db[name] : null;
    if (!u || typeof u !== 'object' || Array.isArray(u)) u = createDefaultUser();

    if (typeof u.points !== 'number' || isNaN(u.points)) u.points = 2000;
    if (typeof u.lastCheckIn !== 'string') u.lastCheckIn = '';
    if (!Array.isArray(u.items)) u.items = [];
    if (u.luxuries) delete u.luxuries; // 사치품 제거됨
    if (!u.coins || typeof u.coins !== 'object') u.coins = {};
    // 기존 employees 필드는 삭제 (RPG 개편으로 제거됨)
    if (u.employees) delete u.employees;
    if (!Array.isArray(u.gachaItems)) u.gachaItems = [];
    if (!u.boxes || typeof u.boxes !== 'object') u.boxes = {};
    if (!u.loan || typeof u.loan !== 'object') u.loan = { amount: 0, takenAt: 0 };
    if (!u.deposit || typeof u.deposit !== 'object') u.deposit = { amount: 0, depositedAt: 0 };
    else {
        if (typeof u.deposit.amount !== 'number' || isNaN(u.deposit.amount)) u.deposit.amount = 0;
        if (typeof u.deposit.depositedAt !== 'number' || isNaN(u.deposit.depositedAt)) u.deposit.depositedAt = 0;
    }
    if (typeof u.seized !== 'boolean') u.seized = false;
    if (!u.stats || typeof u.stats !== 'object') u.stats = createDefaultUser().stats;
    // === RPG 필드 정규화 ===
    if (typeof u.stones !== 'number' || isNaN(u.stones)) u.stones = 0;
    if (typeof u.souls !== 'number' || isNaN(u.souls)) u.souls = 0;
    if (!u.partyMembers || typeof u.partyMembers !== 'object') u.partyMembers = {};
    if (!Array.isArray(u.activeParty)) u.activeParty = [];
    if (!u.equipment || typeof u.equipment !== 'object') u.equipment = { weapon: null, armor: null, shield: null, ring1: null, ring2: null };
    else {
        for (const slot of ['weapon','armor','shield','ring1','ring2']) {
            if (!(slot in u.equipment)) u.equipment[slot] = null;
            const it = u.equipment[slot];
            if (it && typeof it === 'object') {
                if (typeof it.enhanceLevel !== 'number' || isNaN(it.enhanceLevel)) it.enhanceLevel = 0;
                if (typeof it.atk !== 'number') it.atk = 0;
                if (typeof it.def !== 'number') it.def = 0;
                if (typeof it.hp !== 'number') it.hp = 0;
                if (typeof it.broken !== 'boolean') it.broken = false;
                if (it.effect === undefined) it.effect = null;
                if (!it.id) it.id = nextEquipId();
            }
        }
    }
    if (!Array.isArray(u.equipmentInventory)) u.equipmentInventory = [];
    else {
        u.equipmentInventory = u.equipmentInventory.filter(it => it && typeof it === 'object');
        for (const it of u.equipmentInventory) {
            if (typeof it.enhanceLevel !== 'number' || isNaN(it.enhanceLevel)) it.enhanceLevel = 0;
            if (typeof it.atk !== 'number') it.atk = 0;
            if (typeof it.def !== 'number') it.def = 0;
            if (typeof it.hp !== 'number') it.hp = 0;
            if (typeof it.broken !== 'boolean') it.broken = false;
            if (it.effect === undefined) it.effect = null;
            if (!it.id) it.id = nextEquipId();
        }
    }
    if (!Array.isArray(u.skills)) u.skills = [];
    if (typeof u.huntCount !== 'number' || isNaN(u.huntCount)) u.huntCount = 0;
    if (typeof u.huntWins !== 'number' || isNaN(u.huntWins)) u.huntWins = 0;
    if (!u.bossKills || typeof u.bossKills !== 'object') u.bossKills = {};
    if (!u.firstBossClears || typeof u.firstBossClears !== 'object') u.firstBossClears = {};
    if (typeof u.lastHuntAt !== 'number') u.lastHuntAt = 0;
    if (typeof u.lastRaidAt !== 'number') u.lastRaidAt = 0;
    if (!Array.isArray(u.spells)) u.spells = [];
    if (typeof u.mana !== 'number' || isNaN(u.mana)) u.mana = 20;
    // 파티원 데이터 정규화
    for (const k of Object.keys(u.partyMembers)) {
        const v = u.partyMembers[k];
        if (typeof v === 'number') u.partyMembers[k] = { count: v, level: 0 };
        else if (v && typeof v === 'object') {
            u.partyMembers[k] = {
                count: (typeof v.count === 'number' && !isNaN(v.count)) ? v.count : 0,
                level: (typeof v.level === 'number' && !isNaN(v.level)) ? v.level : 0
            };
        } else {
            u.partyMembers[k] = { count: 0, level: 0 };
        }
    }
    for (const game of ['sutda','blackjack','baccarat','numberGuess','duel']) {
        if (!u.stats[game]) u.stats[game] = { wins: 0, losses: 0, draws: 0 };
    }

    for (const c of COIN_NAMES) {
        u.coins[c] = normalizeHolding(u.coins[c] || 0);
    }

    db[name] = u;
    return u;
}

function userExists(db, name) {
    return Object.prototype.hasOwnProperty.call(db, name)
        && db[name] && typeof db[name] === 'object' && !Array.isArray(db[name]);
}

function updateAvgBuy(holding, qty, price) {
    const oldCount = holding.count || 0;
    const oldAvg = holding.avgPrice || 0;
    const newCount = oldCount + qty;
    holding.count = newCount;
    holding.avgPrice = newCount > 0 ? Math.round((oldAvg * oldCount + price * qty) / newCount) : 0;
}

// 대출 이자 계산 (시간당 3%)
function calcLoanDebt(loan) {
    if (!loan || loan.amount <= 0 || loan.takenAt <= 0) return 0;
    const hoursElapsed = (Date.now() - loan.takenAt) / 3600000;
    const rate = CONFIG.loan.hourlyInterestRate / 100;
    return Math.floor(loan.amount * Math.pow(1 + rate, hoursElapsed));
}

// 예금 이자 계산 (예치 후 graceMinutes 지나야 이자 발생, 단리 · 아주 적은 이율)
function calcDepositInterest(deposit) {
    if (!deposit || deposit.amount <= 0 || deposit.depositedAt <= 0) return 0;
    const elapsedMin = (Date.now() - deposit.depositedAt) / 60000;
    const grace = CONFIG.deposit.graceMinutes;
    if (elapsedMin < grace) return 0;
    const interestHours = (elapsedMin - grace) / 60;
    const rate = CONFIG.deposit.hourlyInterestRate / 100;
    return Math.floor(deposit.amount * rate * interestHours);
}

// ═══════════════════════════════════════════════════════
// 6. 헬퍼 함수
// ═══════════════════════════════════════════════════════
function formatKRW(n) {
    if (n == null || isNaN(n)) return '0원';
    const neg = n < 0;
    n = Math.abs(Math.floor(n));
    if (n === 0) return '0원';
    const 해 = Math.floor(n / 100_000_000_000_000_000_000);
    const 경 = Math.floor((n % 100_000_000_000_000_000_000) / 10_000_000_000_000_000);
    const 조 = Math.floor((n % 10_000_000_000_000_000) / 1_000_000_000_000);
    const 억 = Math.floor((n % 1_000_000_000_000) / 100_000_000);
    const 만 = Math.floor((n % 100_000_000) / 10_000);
    const 나머지 = n % 10_000;
    const parts = [];
    if (해 > 0) parts.push(`${해}해`);
    if (경 > 0) parts.push(`${경}경`);
    if (조 > 0) parts.push(`${조}조`);
    if (억 > 0) parts.push(`${억}억`);
    if (만 > 0) parts.push(`${만}만`);
    if (나머지 > 0) parts.push(`${나머지}원`);
    const result = parts.join(' ');
    return neg ? '-' + result : result;
}

function parseAmount(str) {
    if (str == null) return NaN;
    str = String(str).trim();
    const match = str.match(/^(\d+(?:\.\d+)?)(만|억|조)?$/);
    if (!match) return parseInt(str, 10);
    const num = parseFloat(match[1]);
    const unit = match[2];
    if (unit === '만') return Math.round(num * MAN);
    if (unit === '억') return Math.round(num * EOK);
    if (unit === '조') return Math.round(num * JO);
    return Math.round(num);
}

function resolveBetAmount(arg, maxPoints) {
    if (arg === '올인') return maxPoints;
    if (arg === '하프') return Math.floor(maxPoints / 2);
    if (arg === '삥') return 1000;
    if (arg === '따당') return maxPoints * 2; // 따당은 2배 — 잔고 검사는 호출부에서
    const n = parseAmount(arg);
    return isNaN(n) ? NaN : n;
}

function isFullKeyword(arg) { return arg === '풀'; }

function applyFee(amount, gameKey) {
    const feeRate = (CONFIG.fees[gameKey] || 0) / 100;
    const fee = Math.floor(amount * feeRate);
    return { net: amount - fee, fee };
}

// 보유 아이템 중 특정 타입 하나 소모 (가장 먼저 찾은 것)
function consumeItem(user, type) {
    const idx = user.gachaItems.findIndex(it => it.type === type);
    if (idx === -1) return false;
    user.gachaItems.splice(idx, 1);
    return true;
}

function hasItem(user, type) {
    return user.gachaItems.some(it => it.type === type);
}

function sumItemEffect(user, type) {
    return user.gachaItems.filter(it => it.type === type).reduce((s, it) => s + (it.value || 0), 0);
}

// ─────────────────────────────────────────────
// RPG 헬퍼 함수들
// ─────────────────────────────────────────────

// 파티원 강화 자동 처리 (10명 모이면 +1강화, count를 10 소모)
function promoteParty(user) {
    for (const name of Object.keys(user.partyMembers)) {
        const p = user.partyMembers[name];
        while (p.count >= 10) {
            p.count -= 10;
            p.level += 1;
        }
    }
}

// 파티원 전투 스탯 계산 (강화 레벨 반영)
// 레벨당 스킬 파워 +25%, 기본 공격력 기여도 별도
function calcPartyMemberPower(name, level) {
    const base = PARTY_MEMBERS[name];
    if (!base) return { skillPower: 0, atkContrib: 0 };
    const mult = 1 + (level * 0.25);
    return {
        skillPower: Math.floor(base.baseSkillPower * mult),
        atkContrib: Math.floor(base.baseSkillPower * mult * 0.5) // 편성만 해도 공격력 소량 기여
    };
}

// 장비 스탯 계산 (강화 레벨 반영)
function calcEquipmentStat(equipment) {
    let atk = 0, def = 0, hp = 0;
    if (!equipment) return { atk, def, hp };
    for (const slot of Object.keys(equipment)) {
        const eq = equipment[slot];
        if (!eq) continue;
        const eff = effectiveItemStat(eq);
        atk += eff.atk;
        def += eff.def;
        hp  += eff.hp;
    }
    return { atk, def, hp };
}

// 캐릭터 총 스탯 계산 (기본 + 장비 + 파티 기여)
function calcCharacterStat(user) {
    const BASE_ATK = 10;
    const BASE_DEF = 5;
    const BASE_HP  = 100;

    const eq = calcEquipmentStat(user.equipment);
    const sk = calcSkillStat(user.skills);
    let atk = BASE_ATK + eq.atk + sk.atk;
    let def = BASE_DEF + eq.def + sk.def;
    let hp  = BASE_HP  + eq.hp  + sk.hp;

    // 파티원 편성 기여
    for (const name of (user.activeParty || [])) {
        const p = user.partyMembers[name];
        if (!p) continue;
        const power = calcPartyMemberPower(name, p.level);
        atk += power.atkContrib;
    }

    return { atk, def, hp, maxHp: hp };
}

// 총자산 계산
function calcNetWorth(user) {
    let coinValue = 0;
    for (const [name, h] of Object.entries(user.coins || {})) {
        const count = h.count || 0;
        if (count > 0 && COIN_MARKET[name]) coinValue += COIN_MARKET[name].currentPrice * count;
    }
    const debt = calcLoanDebt(user.loan);
    const depositTotal = (user.deposit && user.deposit.amount > 0) ? (user.deposit.amount + calcDepositInterest(user.deposit)) : 0;
    return {
        cash: user.points,
        luxuryValue: 0, // 레거시 필드 유지 (참조 안전)
        coinValue,
        depositValue: depositTotal,
        empEarning: 0,
        debt,
        total: user.points + coinValue + depositTotal - debt
    };
}

// 업적 레벨 계산
function getAchievementLevel(user, game) {
    const wins = (user.stats[game] && user.stats[game].wins) || 0;
    const levels = ACHIEVEMENTS[game];
    if (!levels) return null;
    let current = null;
    for (const lvl of levels) {
        if (wins >= lvl.wins) current = lvl;
    }
    return current;
}

// 이름 표시 (업적 타이틀 적용)
function displayName(user, name) {
    // 가장 화려한(레벨 높은) 업적 우선
    const games = ['sutda','blackjack','baccarat','numberGuess','duel'];
    let best = null;
    for (const g of games) {
        const lvl = getAchievementLevel(user, g);
        if (lvl && (!best || lvl.level > best.level)) best = { lvl, g };
    }
    if (!best) return name;
    return best.lvl.display(name);
}

// 번호→이름 매핑
// getEmployeeList: 레거시 제거됨 (직원 시스템 폐지)
// resolveEmployeeName: 레거시 제거됨

// resolveOwnedEmployee: 레거시 제거됨

function formatChangeRate(avgPrice, currentPrice) {
    if (!avgPrice || avgPrice <= 0) return '';
    const rate = ((currentPrice - avgPrice) / avgPrice) * 100;
    return ` (${rate >= 0 ? '🔺+' : '🔻'}${Math.abs(rate).toFixed(1)}%)`;
}

// ═══════════════════════════════════════════════════════
// 7. 게임 로직
// ═══════════════════════════════════════════════════════

// ── 섯다 족보 ──────────────────────────────────────────
function evaluateHand(p1, p2) {
    const m1 = p1.m, m2 = p2.m, n1 = p1.name, n2 = p2.name;
    if ((n1==='3광'&&n2==='8광')||(n1==='8광'&&n2==='3광')) return { score:3000, name:'38광땡' };
    if ((n1==='1광'&&n2==='3광')||(n1==='3광'&&n2==='1광')) return { score:2900, name:'13광땡' };
    if ((n1==='1광'&&n2==='8광')||(n1==='8광'&&n2==='1광')) return { score:2800, name:'18광땡' };
    if (m1===m2) return { score:2000+m1*10, name:`${m1}땡` };
    const s = [m1,m2].sort((a,b)=>a-b);
    if (s[0]===1&&s[1]===2) return { score:1900, name:'알리' };
    if (s[0]===1&&s[1]===4) return { score:1800, name:'독사' };
    if (s[0]===1&&s[1]===9) return { score:1700, name:'구삥' };
    if (s[0]===1&&s[1]===10) return { score:1600, name:'장삥' };
    if (s[0]===4&&s[1]===10) return { score:1500, name:'장사' };
    if (s[0]===4&&s[1]===6) return { score:1400, name:'세륙' };
    const k = (m1+m2)%10;
    if (k===9) return { score:1009, name:'갑오(9끗)' };
    if (k===0) return { score:1000, name:'망통(0끗)' };
    return { score:1000+k, name:`${k}끗` };
}

// ── 블랙잭 ─────────────────────────────────────────────
const BJ_SUITS = ['♠','♥','♦','♣'];
const BJ_RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function drawCard() {
    return { rank: BJ_RANKS[Math.floor(Math.random()*13)], suit: BJ_SUITS[Math.floor(Math.random()*4)] };
}
function cardStr(c) { return `${c.rank}${c.suit}`; }
function handStr(h) { return h.map(cardStr).join(' '); }
function calcBJ(hand) {
    let t=0, a=0;
    for (const c of hand) {
        if (c.rank==='A') { t+=11; a++; }
        else if (['J','Q','K'].includes(c.rank)) t+=10;
        else t+=parseInt(c.rank);
    }
    while (t>21&&a>0) { t-=10; a--; }
    return t;
}
function isBJ(hand) { return hand.length===2&&calcBJ(hand)===21; }
function dealerPlayBJ(hand) {
    while (calcBJ(hand)<17) hand.push(drawCard());
    return hand;
}
function judgeBJ(pH, dH, bet, isSplit) {
    const ps=calcBJ(pH), ds=calcBJ(dH);
    const pBJ=!isSplit&&isBJ(pH), dBJ=isBJ(dH);
    if (ps>21) return { type:'BUST', payout:-bet };
    if (pBJ&&!dBJ) return { type:'BLACKJACK', payout:Math.floor(bet*1.5) };
    if (pBJ&&dBJ) return { type:'PUSH', payout:0 };
    if (ds>21) return { type:'WIN', payout:bet };
    if (ps>ds) return { type:'WIN', payout:bet };
    if (ps<ds) return { type:'LOSE', payout:-bet };
    return { type:'PUSH', payout:0 };
}
function bjLabel(type) {
    return {BLACKJACK:'🃏 블랙잭!',WIN:'🏆 승리!',LOSE:'💸 패배',PUSH:'🤝 무승부',BUST:'💥 버스트'}[type]||type;
}

function advanceBJ(db, room, sender) {
    const s = blackjackSessions[room];
    if (!s) return '';
    const next = s.hands.findIndex((h,i)=>i>s.activeIdx&&!h.done);
    if (next!==-1) {
        s.activeIdx=next; s.canFirst=true;
        const h=s.hands[next];
        return `\n➡️ [${next+1}번째 패]\n🃏 ${handStr(h.cards)} (${calcBJ(h.cards)})\n💵 !히트 / !스탠드 / !더블다운`;
    }
    const user=ensureUser(db,sender);
    const allBust=s.hands.every(h=>calcBJ(h.cards)>21);
    if (!allBust) dealerPlayBJ(s.dealerHand);
    const ds=calcBJ(s.dealerHand);
    let msg=`\n\n🤖 딜러 패 공개: ${handStr(s.dealerHand)} (${ds})\n──────────────────\n`;
    let total=0;
    s.hands.forEach((h,i)=>{
        const bet=h.doubled?s.bet*2:s.bet;
        const j=judgeBJ(h.cards,s.dealerHand,bet,s.hands.length>1);
        total+=bet+j.payout;
        const prefix=s.hands.length>1?`[${i+1}번째] `:'';
        msg+=`${prefix}${handStr(h.cards)} (${calcBJ(h.cards)}) → ${bjLabel(j.type)} ${j.payout>=0?'+':''}${formatKRW(j.payout)}\n`;
        // 업적
        if (j.type==='WIN'||j.type==='BLACKJACK') user.stats.blackjack.wins=(user.stats.blackjack.wins||0)+1;
        else if (j.type==='LOSE'||j.type==='BUST') user.stats.blackjack.losses=(user.stats.blackjack.losses||0)+1;
    });
    // 수수료
    let netTotal=total; let feeMsg='';
    if (total>s.bet) {
        const profit=total-s.bet*s.hands.length;
        if (profit>0&&!s.feeWaived) {
            const {net,fee}=applyFee(profit,'blackjack');
            netTotal=s.bet*s.hands.length+net;
            feeMsg=`\n💸 수수료(${CONFIG.fees.blackjack}%): -${formatKRW(fee)}`;
        }
    }
    user.points+=netTotal;
    saveData(db);
    delete blackjackSessions[room];
    msg+=`──────────────────${feeMsg}\n💰 내 지갑: ${formatKRW(user.points)}`;
    return msg;
}

// ── 가챠 ───────────────────────────────────────────────
function rollGacha(boxType, user) {
    const boxCfg = CONFIG.gacha[boxType];
    if (!boxCfg) return null;
    const rates = { ...boxCfg.rates };

    // 신화반지 효과: 등급 확률 부스트
    const boost = sumItemEffect(user, 'gacha_boost');
    if (boost > 0) {
        const boostPer = boost / 100;
        // 낮은 등급에서 빼서 높은 등급에 추가
        const lowGrades = ['꽝','일반','희귀'];
        let totalBorrow = 0;
        for (const g of lowGrades) {
            const borrow = Math.min(rates[g]||0, (rates[g]||0)*boostPer);
            rates[g] = (rates[g]||0) - borrow;
            totalBorrow += borrow;
        }
        rates['신화'] = (rates['신화']||0) + totalBorrow;
    }

    const totalWeight = Object.values(rates).reduce((s,v)=>s+v,0);
    let r = Math.random()*totalWeight;
    let grade = '꽝';
    for (const [g,w] of Object.entries(rates)) {
        if (r<w) { grade=g; break; }
        r-=w;
    }

    const pool = GACHA_ITEM_POOL[grade];
    if (!pool||pool.length===0) return { grade:'꽝', item:GACHA_ITEM_POOL['꽝'][0] };
    const item = pool[Math.floor(Math.random()*pool.length)];
    return { grade, item };
}

const GRADE_EMOJI = { 꽝:'⬛', 일반:'⚪', 희귀:'🔵', 영웅:'🟣', 전설:'🟠', 신화:'🔴' };

// ── 퀴즈 보상 뽑기 ────────────────────────────────────
function rollQuizReward() {
    const pool = CONFIG.quiz.rewardPool;
    const total = pool.reduce((s,r)=>s+r.weight,0);
    let r = Math.random()*total;
    for (const item of pool) {
        if (r<item.weight) return item;
        r-=item.weight;
    }
    return pool[0];
}

// ── 코인 시세 변동 (타이머 기반) ───────────────────────
function updateCoinPrices(broadcastFn) {
    const maxChange = CONFIG.coin.maxChangePercent / 100;

    // 1분 전 예고 뉴스 (진짜/가짜 혼재)
    const targetCoin = COIN_NAMES[Math.floor(Math.random()*COIN_NAMES.length)];
    const isFake = Math.random() < 0.3; // 30% 확률로 가짜뉴스
    const isUp = Math.random() > 0.45;
    const poolKey = isUp ? (isFake?'up_fake':'up_real') : (isFake?'down_fake':'down_real');
    const pool = NEWS_POOL[targetCoin][poolKey] || NEWS_POOL[targetCoin][isUp?'up_real':'down_real'];
    const news = pool[Math.floor(Math.random()*pool.length)];
    const fakeTag = isFake ? ' 🔴[미확인 루머]' : ' 🟢[공식 속보]';

    const preview = `\n📰 [1분 후 시세 변동 예고]${fakeTag}\n${news}`;
    if (broadcastFn) broadcastFn(preview);

    // 1분 후 실제 변동
    setTimeout(() => {
        // 가짜뉴스면 반대 방향으로 움직이거나 무변동
        const actualUp = isFake ? !isUp : isUp;

        for (const key in COIN_MARKET) {
            COIN_MARKET[key].lastPrice = COIN_MARKET[key].currentPrice;
            let move = (Math.random()*maxChange*0.4) - (maxChange*0.2); // 기본 소폭 변동
            if (key === targetCoin) {
                move = actualUp
                    ? (Math.random()*maxChange*0.6)+0.05
                    : -(Math.random()*maxChange*0.5+0.05);
            }
            let nPrice = Math.floor(COIN_MARKET[key].currentPrice * (1+move));
            if (nPrice < 100) nPrice = 100;
            COIN_MARKET[key].currentPrice = nPrice;
        }
        saveMarket();

        let report = `\n📊 [시세 변동 완료]\n`;
        for (const key in COIN_MARKET) {
            const diff = COIN_MARKET[key].currentPrice - COIN_MARKET[key].lastPrice;
            report += `🪙 ${key}: ${formatKRW(COIN_MARKET[key].currentPrice)} (${diff>=0?'🔺+':'🔻'}${formatKRW(Math.abs(diff))})\n`;
        }
        if (broadcastFn) broadcastFn(report);
    }, 60000);
}

// ── 압류 처리 ──────────────────────────────────────────
function seizeAssets(db, name) {
    const user = ensureUser(db, name);
    const debt = calcLoanDebt(user.loan);
    if (debt <= 0) return;

    // 아이템 팔기
    user.gachaItems = [];
    user.boxes = {};
    user.items = [];

    // 코인 팔기
    for (const [n, h] of Object.entries(user.coins)) {
        if (h.count>0 && COIN_MARKET[n]) {
            user.points += COIN_MARKET[n].currentPrice * h.count;
            h.count=0; h.avgPrice=0;
        }
    }

    // 예금 강제 해지
    if (user.deposit && user.deposit.amount > 0) {
        user.points += user.deposit.amount + calcDepositInterest(user.deposit);
        user.deposit = { amount: 0, depositedAt: 0 };
    }

    // 직원 해고: RPG 개편으로 시스템 제거됨 (파티원은 압류 시 유지)

    // 빚 상환 후 마이너스 처리
    user.points -= debt;
    user.loan = { amount: 0, takenAt: 0 };
    user.seized = true;
    saveData(db);
}

// ═══════════════════════════════════════════════════════
// 8. 서버 시작
// ═══════════════════════════════════════════════════════
let broadcastRooms = []; // 뉴스 브로드캐스트 대상 방 목록
let broadcastCallback = null; // 방들에 메시지 보내는 함수

server.on('listening', () => {
    loadConfig();
    loadMarket();

    // 코인 자동 시세 변동 타이머
    const intervalMs = (CONFIG.coin.updateIntervalMinutes || 10) * 60000;
    setInterval(() => {
        if (broadcastCallback && broadcastRooms.length > 0) {
            updateCoinPrices((msg) => {
                for (const room of broadcastRooms) broadcastCallback(room, msg);
            });
        } else {
            updateCoinPrices(null);
        }
    }, intervalMs);

    // 대출 이자 압류 체크 (1시간마다)
    setInterval(() => {
        const db = loadData();
        let changed = false;
        for (const name of Object.keys(db)) {
            const u = ensureUser(db, name);
            if (u.loan.amount > 0) {
                const debt = calcLoanDebt(u.loan);
                const nw = calcNetWorth(u);
                if (debt > nw.total + u.points && !u.seized) {
                    seizeAssets(db, name);
                    changed = true;
                    if (broadcastCallback && broadcastRooms.length > 0) {
                        for (const room of broadcastRooms) {
                            broadcastCallback(room, `⚠️ [압류] ${name}님의 자산이 대출 미상환으로 압류되었습니다!`);
                        }
                    }
                }
            }
        }
        if (changed) saveData(db);
    }, 3600000);

    console.log('\n🎴 타짜봇 v3 가동 완료! (포트 ' + PORT + ')\n');
});

server.on('error', (err) => { console.error('소켓 에러:', err.message); });

server.on('message', (msg, rinfo) => {
    let data;
    try { data = JSON.parse(msg.toString('utf-8')); } catch { return; }
    if (!data || typeof data !== 'object') return;

    const room   = data.room;
    const sender = data.sender;
    const content = (data.msg == null ? '' : String(data.msg)).trim();
    if (!sender || !content || room == null) return;

    // 브로드캐스트 콜백 등록 (처음 메시지 받은 rinfo 기준으로 각 방에 보낼 수 있게)


    try {
        const db = loadData();
        const user = ensureUser(db, sender);

        // 잔액 최저 2000원 보장 — 명령 처리 전에 먼저 적용 후 저장
        if (user.points < MIN_BALANCE) {
            user.points = MIN_BALANCE;
            saveData(db);
        }

        const reply = (text) => {
            const buf = Buffer.from(String(text), 'utf-8');
            server.send(buf, 0, buf.length, rinfo.port, rinfo.address);
        };

        // 브로드캐스트 콜백 설정 (뉴스용)
        if (!broadcastCallback) {
            broadcastCallback = (targetRoom, text) => {
                // 같은 방의 rinfo를 모르므로, 현재 방에만 보낼 수 있음
                // 실제 구현: 방별 rinfo 저장
            };
        }

        const parts = content.split(/\s+/);
        const cmd   = parts[0];
        const args  = parts.slice(1);

        // 압류 상태 게임 차단
        const GAME_CMDS = ['!섯다','!블랙잭','!바카라','!숫자맞추기','!대결신청'];
        if (user.seized && GAME_CMDS.includes(cmd)) {
            return reply('⛔ 자산이 압류된 상태에서는 게임을 할 수 없습니다. !대출조회 로 상태를 확인하세요.');
        }

        // ══════════════════════════════════════════════
        // 뉴스 ON/OFF (운영자만)
        // ══════════════════════════════════════════════
        if (cmd === '!뉴스켜기') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 운영자 전용 명령어입니다.');
            if (!activeNewsRooms.includes(room)) activeNewsRooms.push(room);
            return reply('📰 이 방의 코인 뉴스 자동 발송이 활성화되었습니다.');
        }
        if (cmd === '!뉴스끄기') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 운영자 전용 명령어입니다.');
            activeNewsRooms = activeNewsRooms.filter(r=>r!==room);
            return reply('🔕 이 방의 코인 뉴스 자동 발송이 비활성화되었습니다.');
        }

        // ══════════════════════════════════════════════
        // 운영자 명령어
        // ══════════════════════════════════════════════
        if (cmd === '!관리자지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !관리자지급 [닉네임] [금액]');
            const target = ensureUser(db, args[0]);
            const amt = parseAmount(args[1]);
            if (isNaN(amt)) return reply('❌ 금액 오류');
            const before = target.points;
            target.points += amt;
            if (target.points < 0) target.points = 0;
            saveData(db);
            return reply(`🛡️ [지급 완료] ${args[0]}: ${formatKRW(before)} → ${formatKRW(target.points)}`);
        }

        if (cmd === '!관리자설정') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !관리자설정 [닉네임] [금액]');
            const target = ensureUser(db, args[0]);
            const amt = parseAmount(args[1]);
            if (isNaN(amt)||amt<0) return reply('❌ 금액 오류');
            target.points = amt;
            saveData(db);
            return reply(`🛡️ [설정 완료] ${args[0]} → ${formatKRW(amt)}`);
        }

        if (cmd === '!관리자초기화') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 1) return reply('❌ !관리자초기화 [닉네임]');
            if (!userExists(db, args[0])) return reply(`❌ "${args[0]}" 유저 없음`);
            db[args[0]] = createDefaultUser();
            saveData(db);
            return reply(`🛡️ [초기화 완료] ${args[0]}`);
        }

        if (cmd === '!관리자파티지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !관리자파티지급 [닉네임] [파티원이름] [수량(기본1)]\n예: !관리자파티지급 홍길동 김판돌 10\n예2: !관리자파티지급 홍길동 검은 지배자 1');
            const target = ensureUser(db, args[0]);
            const matched = matchPartyMemberFromArgs(args, 1);
            if (!matched) return reply(`❌ 존재하지 않는 파티원입니다.\n(가능: ${Object.keys(PARTY_MEMBERS).join(', ')})`);
            const memberName = matched.name;
            const qty = parseInt(args[matched.nextIdx] || '1', 10);
            if (isNaN(qty) || qty < 1) return reply('❌ 수량 오류');
            if (!target.partyMembers[memberName]) target.partyMembers[memberName] = { count: 0, level: 0 };
            target.partyMembers[memberName].count += qty;
            promoteParty(target);
            saveData(db);
            return reply(`🛡️ [파티원 지급] ${args[0]}에게 ${memberName} x${qty} 지급\n현재: +${target.partyMembers[memberName].level} / ${target.partyMembers[memberName].count}개 보유`);
        }

        if (cmd === '!관리자강화석지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !관리자강화석지급 [닉네임] [수량]');
            const target = ensureUser(db, args[0]);
            const qty = parseInt(args[1], 10);
            if (isNaN(qty)) return reply('❌ 수량 오류');
            target.stones = (target.stones || 0) + qty;
            if (target.stones < 0) target.stones = 0;
            saveData(db);
            return reply(`🛡️ [강화석 지급] ${args[0]}: ${qty>=0?'+':''}${qty}\n현재: ${target.stones.toLocaleString()}개`);
        }

        if (cmd === '!관리자소울지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !관리자소울지급 [닉네임] [수량]');
            const target = ensureUser(db, args[0]);
            const qty = parseInt(args[1], 10);
            if (isNaN(qty)) return reply('❌ 수량 오류');
            target.souls = (target.souls || 0) + qty;
            if (target.souls < 0) target.souls = 0;
            saveData(db);
            return reply(`🛡️ [소울 지급] ${args[0]}: ${qty>=0?'+':''}${qty}\n현재: ${target.souls.toLocaleString()}개`);
        }

        if (cmd === '!관리자장비지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 3) return reply('❌ !관리자장비지급 [닉네임] [부위] [등급] [수량(기본1)]\n(부위: 무기/방어구/방패/반지)\n(등급: 초급/중급/고급/영웅/전설/신화/태초)');
            const target = ensureUser(db, args[0]);
            const raw = SLOT_ALIASES[args[1]];
            const slotType = (raw === 'ring1' || raw === 'ring2') ? 'ring' : raw;
            if (!slotType) return reply('❌ 부위는 무기/방어구/방패/반지 중 하나여야 합니다.');
            const grade = args[2];
            if (!EQUIP_GRADES.includes(grade)) return reply(`❌ 존재하지 않는 등급: ${grade}\n(가능: ${EQUIP_GRADES.join(', ')})`);
            const qty = parseInt(args[3] || '1', 10);
            if (isNaN(qty) || qty < 1) return reply('❌ 수량 오류');
            for (let i = 0; i < qty; i++) target.equipmentInventory.push(createEquipmentItem(slotType, grade));
            saveData(db);
            return reply(`🛡️ [장비 지급] ${args[0]}에게 ${grade} ${args[1]} x${qty} 지급 완료 (인벤토리 확인: !장비인벤)`);
        }

        if (cmd === '!관리자마법지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !관리자마법지급 [닉네임] [마법ID] [수량(기본1)]\n예) !관리자마법지급 홍길동 fireball 10');
            const target = ensureUser(db, args[0]);
            const spellId = args[1];
            const mb = getMagicBook(spellId);
            if (!mb) return reply(`❌ 마법 ID 오류: ${spellId}\n(ID 목록: ${MAGIC_BOOKS.map(m=>m.id).join(', ')})`);
            const qty = parseInt(args[2] || '1', 10);
            if (isNaN(qty) || qty < 1) return reply('❌ 수량 오류');
            if (!target.spells) target.spells = [];
            for (let i = 0; i < qty; i++) target.spells.push(spellId);
            const evolMsgs = checkMagicEvolution(target);
            saveData(db);
            let msg = `🔮 [마법 지급] ${args[0]}에게 ${mb.element}${mb.name} × ${qty} 지급`;
            if (evolMsgs.length) msg += '\n' + evolMsgs.join('\n');
            return reply(msg);
        }

        if (cmd === '!관리자아이템지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            // !관리자아이템지급 [닉네임] [아이템타입] [수량]
            if (args.length < 2) return reply('❌ !관리자아이템지급 [닉네임] [아이템타입] [수량(기본1)]');
            const target = ensureUser(db, args[0]);
            const itemType = args[1];
            const qty = parseInt(args[2]||'1',10);
            // 모든 풀에서 해당 타입 찾기
            let found = null;
            for (const pool of Object.values(GACHA_ITEM_POOL)) {
                const it = pool.find(i=>i.type===itemType||i.name===itemType);
                if (it) { found=it; break; }
            }
            if (!found) return reply(`❌ "${itemType}" 아이템을 찾을 수 없습니다.`);
            for (let i=0;i<qty;i++) target.gachaItems.push({...found});
            saveData(db);
            return reply(`🛡️ [아이템 지급] ${args[0]}에게 [${found.name}] x${qty} 지급 완료`);
        }

        if (cmd === '!설정보기') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            const feeStr = Object.entries(CONFIG.fees).map(([k,v])=>`${k}:${v}%`).join(', ');
            return reply(
                `⚙️ [현재 설정]\n` +
                `─────────────────────\n` +
                `💸 수수료: ${feeStr}\n` +
                `🎲 섯다 딜러다이 최대확률: ${CONFIG.sutda.dealerDieMaxChance}%\n` +
                `🪙 코인 업데이트 주기: ${CONFIG.coin.updateIntervalMinutes}분\n` +
                `💰 대출 시간당 이자: ${CONFIG.loan.hourlyInterestRate}%\n` +
                `👔 직원 세율: ${CONFIG.employee.taxRate}%\n` +
                `📰 뉴스 운영자: ${CONFIG.newsAdmins.join(', ')}`
            );
        }

        if (cmd === '!설정') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !설정 [경로] [값]\n예: !설정 fees.sutda 3');
            const before = getConfigValue(args[0]);
            setConfigValue(args[0], args[1]);
            const after = getConfigValue(args[0]);
            return reply(`⚙️ [설정 변경] ${args[0]}: ${before} → ${after}`);
        }

        if (cmd === '!시즌초기화') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args[0] !== '확인') return reply('⚠️ 시즌 초기화를 진행하려면 !시즌초기화 확인 을 입력하세요.\n모든 유저 데이터가 초기화됩니다!');
            const names = Object.keys(db);
            for (const n of names) db[n] = createDefaultUser();
            saveData(db);
            // 마켓도 초기화
            COIN_MARKET = JSON.parse(JSON.stringify(DEFAULT_COIN));
            saveMarket();
            return reply(`🏁 [시즌 초기화 완료]\n총 ${names.length}명의 데이터가 초기화되었습니다.\n새 시즌을 시작합니다!`);
        }

        // ══════════════════════════════════════════════
        // 도움말
        // ══════════════════════════════════════════════
        if (cmd === '!도움말') {
            return reply(
                '📜 [타짜봇 v3 가이드]\n' +
                '━━━━━━━━━━━━━━━━━━━━\n\n' +
                '📊 [내 정보]\n' +
                ' !내정보 — 현금·자산 요약\n' +
                ' !내아이템 — 보유 아이템\n' +
                ' !내코인 — 코인 현황\n' +
                ' !랭킹 — 랭킹 종류 안내\n' +
                ' !자산랭킹 / !스탯랭킹 / !합랭킹\n\n' +
                '🎰 [게임]\n' +
                ' !섯다 [금액] — 섯다 시작\n' +
                ' !블랙잭 [금액] — 블랙잭\n' +
                ' !바카라 [플레이어/뱅커/타이] [금액] — 바카라\n' +
                ' !숫자맞추기 [개수] — 숫자맞추기 개설\n' +
                ' !숫자배팅 [금액] [숫자] — 참여\n' +
                ' !대결신청 [닉네임] [금액] — 1:1주사위\n\n' +
                '📦 [상자]\n' +
                ' !상자목록 — 구매 가능한 상자 종류\n' +
                ' !상자구매 [종류] [수량]\n' +
                ' !상자열기 [종류] [수량]\n' +
                ' !내상자 — 보유 상자 목록\n\n' +
                '📈 [거래소]\n' +
                ' !코인시세 — 코인 시세 확인\n' +
                ' !매수 [코인명] [금액or수량or풀]\n' +
                ' !매도 [코인명] [금액or수량or풀]\n\n' +
                '⚔️ [RPG - 파티]\n' +
                ' !내스탯 — 캐릭터 스탯 확인\n' +
                ' !파티 — 편성된 파티 확인\n' +
                ' !파티원 — 보유 파티원 목록\n' +
                ' !파티편성 [이름] [이름] [이름] — 파티 편성 (최대 3명)\n\n' +
                '🗡️ [RPG - 장비]\n' +
                ' !장비 / !장비인벤 — 장착/보유 장비 확인\n' +
                ' !장비장착 [이름or번호] / !장비해제 [슬롯]\n' +
                ' !장비강화 [슬롯] — 동일 부위/등급 10개+골드+강화석 소모\n' +
                ' !장비판매 [번호]\n' +
                ' !장비상점 / !장비구매 [부위] — 초급 장비 구매\n' +
                ' !장비상자목록 / !장비상자구매 / !장비상자열기\n' +
                ' !용병상자목록 / !용병상자구매 / !용병상자열기\n\n' +
                '🏦 [은행]\n' +
                ' !대출 [금액] — 대출 (자산 50% 한도)\n' +
                ' !상환 [금액or전액] — 대출 상환\n' +
                ' !대출조회 — 현재 대출 현황\n' +
                ' !예금 [금액] — 예치 (20분 후부터 이자)\n' +
                ' !출금 [금액or전액] / !예금조회\n\n' +
                '🏕️ [사냥터]\n' +
                ' !사냥터 — 사냥터 목록/보상\n' +
                ' !사냥시작 [사냥터명] — 사냥 파견\n' +
                ' !사냥종료 — 귀환 + 전리품 수령\n' +
                ' !사냥현황 — 진행 중 확인\n' +
                ' !장비수리 [슬롯] / !장비수리전체\n\n' +
                '👹 [레이드]\n' +
                ' !레이드목록 — 보스 목록/보상/처치 여부\n' +
                ' !레이드 [보스이름] — 레이드 시작 (120초 쿨타임)\n' +
                ' !공격 / !강공 / !방어 / !회피 / !방해 / !후퇴\n' +
                ' 💡 보스 예고 패턴에 맞는 액션 → 보너스\n' +
                ' ⏱️ 1분 이내 행동 없으면 자동 후퇴\n' +
                ' ⚠️ 패배 시 장착 장비 1개 랜덤 파손\n\n' +
                '📖 [스킬/마법]\n' +
                ' !스킬목록 / !내스킬 / !스킬습득 [이름]\n' +
                ' !마법목록 — 구매 가능한 마법 전체 확인\n' +
                ' !내마법 — 보유 마법 + 현재 마력\n' +
                ' !마법구매 [마법이름] — 소울+골드 구매\n' +
                ' !마법합성 — 같은 마법 10개→상위 마법\n' +
                ' 🔮 사냥터 귀환/레이드 클리어 시 25% 확률 드랍\n\n' +
                '🌌 [시즌]\n' +
                ' !시즌정보 — 시즌 보상/기간 확인\n\n' +
                '💡 [금액 입력]\n' +
                ' 숫자, 1만, 1.5억, 1조 모두 가능\n' +
                ' 배팅: 올인/하프/삥/따당'
            );
        }

        // ══════════════════════════════════════════════
        // 출석
        // ══════════════════════════════════════════════
        if (cmd === '!출석') {
            const today = new Date().toISOString().split('T')[0];
            if (user.lastCheckIn === today) return reply('⚠️ 오늘 이미 출석했습니다.');
            user.points += 2000;
            user.lastCheckIn = today;
            saveData(db);
            return reply(`🎉 [출석 완료]\n💵 지급: +2,000원\n💰 잔액: ${formatKRW(user.points)}`);
        }

        // ══════════════════════════════════════════════
        // 내 정보 (분리된 명령어)
        // ══════════════════════════════════════════════
        if (cmd === '!내정보') {
            promoteParty(user);
            saveData(db);
            const nw = calcNetWorth(user);
            const stat = calcCharacterStat(user);
            const debt = calcLoanDebt(user.loan);
            
            // 게임별 업적 타이틀
            const gameAchievements = [];
            for (const [game] of Object.entries(ACHIEVEMENTS)) {
                const lvl = getAchievementLevel(user, game);
                if (lvl) gameAchievements.push(lvl.title);
            }
            
            // 특수 타이틀 (RPG/컬렉션/부)
            const specialTitles = getEarnedTitles(user);
            const topTitle = specialTitles[0]?.title || displayName(user, sender);
            const otherTitles = specialTitles.slice(1, 5).map(t => t.title);
            
            let msg = `${topTitle}
`;
            if (otherTitles.length > 0) msg += `${otherTitles.join(' ')}
`;
            if (gameAchievements.length > 0) msg += `${gameAchievements.slice(0,3).join(' / ')}
`;
            msg += `━━━━━━━━━━━━━━━━━━━━
`;
            msg += `💰 골드: ${formatKRW(user.points)}
`;
            msg += `💎 강화석: ${(user.stones||0).toLocaleString()}개
`;
            msg += `🌌 소울: ${(user.souls||0).toLocaleString()}개
`;
            msg += `━━━━━━━━━━━━━━━━━━━━
`;
            msg += `⚔️ 공격력: ${stat.atk.toLocaleString()}
`;
            msg += `🛡️ 방어력: ${stat.def.toLocaleString()}
`;
            msg += `❤️ HP: ${stat.maxHp.toLocaleString()}
`;
            msg += `━━━━━━━━━━━━━━━━━━━━
`;
            msg += `🪙 코인가치: ${formatKRW(nw.coinValue)}
`;
            if (nw.depositValue > 0) msg += `🏦 예금: ${formatKRW(nw.depositValue)}
`;
            if (debt > 0) msg += `🏦 대출채무: -${formatKRW(debt)}
`;
            msg += `💎 총자산: ${formatKRW(nw.total)}
`;
            // 진행 상황 요약
            const bossCount = Object.keys(user.bossKills || {}).length;
            const partyCount = user.activeParty ? user.activeParty.length : 0;
            if (bossCount > 0 || user.huntWins > 0 || partyCount > 0) {
                msg += `━━━━━━━━━━━━━━━━━━━━
`;
                if (partyCount > 0) msg += `⚔️ 파티: ${user.activeParty.map(n => `${n} +${user.partyMembers[n].level}`).join(' / ')}
`;
                if (bossCount > 0) msg += `🏆 클리어 보스: ${bossCount}종
`;
                if (user.huntWins > 0) msg += `🏹 사냥 성공: ${user.huntWins}회
`;
            }
            // 파손 장비 경고
            const brokenCount = ['weapon','armor','shield','ring1','ring2'].filter(s => user.equipment[s] && user.equipment[s].broken).length;
            if (brokenCount > 0) msg += `⚠️ 파손된 장비 ${brokenCount}개 (!장비수리전체)
`;
            return reply(msg);
        }

        if (cmd === '!내아이템') {
            if (!user.gachaItems||user.gachaItems.length===0) return reply('❌ 보유한 아이템이 없습니다.\n!상자열기 로 획득해보세요.');
            const grouped = {};
            for (const it of user.gachaItems) {
                if (!grouped[it.name]) grouped[it.name]={...it,count:0};
                grouped[it.name].count++;
            }
            let msg = `🎒 [${sender}님의 아이템]\n─────────────────────\n`;
            for (const [,it] of Object.entries(grouped)) {
                msg += `${GRADE_EMOJI[it.grade]||'⚪'} [${it.grade}] ${it.name} x${it.count}\n   ㄴ ${it.desc}\n`;
            }
            return reply(msg);
        }

        if (cmd === '!내코인') {
            let msg = `🪙 [${sender}님의 코인]\n─────────────────────\n`;
            let any = false;
            for (const [name, h] of Object.entries(user.coins)) {
                if (!h||h.count<=0) continue;
                any = true;
                const cur = COIN_MARKET[name]?.currentPrice || 0;
                const rate = formatChangeRate(h.avgPrice, cur);
                msg += `${name}: ${h.count.toLocaleString()}개\n`;
                msg += `   평단 ${formatKRW(h.avgPrice)} / 현재 ${formatKRW(cur)}${rate}\n`;
            }
            if (!any) msg += '보유 코인 없음';
            return reply(msg);
        }

        if (cmd === '!내직원') {
            return reply('⚠️ 직원 시스템은 RPG 개편으로 제거되었습니다.\n대신 !파티원, !파티 를 사용해주세요. (용병 뽑기: !용병상자구매)');
        }

        // ══════════════════════════════════════════════
        // RPG - 파티 시스템
        // ══════════════════════════════════════════════
        if (cmd === '!파티원') {
            promoteParty(user);
            saveData(db);
            const owned = Object.entries(user.partyMembers || {}).filter(([,p]) => (p.count||0) > 0 || (p.level||0) > 0);
            if (owned.length === 0) {
                return reply('❌ 보유 파티원이 없습니다.\n!용병상자구매 로 구매 후 !용병상자열기 로 뽑아보세요.');
            }
            let msg = `👥 [${sender}님의 파티원]\n─────────────────────\n`;
            owned.sort((a,b) => (b[1].level - a[1].level) || (b[1].count - a[1].count));
            for (const [name, p] of owned) {
                const info = PARTY_MEMBERS[name];
                if (!info) continue;
                const power = calcPartyMemberPower(name, p.level);
                const active = user.activeParty.includes(name) ? ' 🟢편성중' : '';
                msg += `[${info.grade}] ${name} +${p.level}${active} — ${ROLE_LABEL[info.skill]||''}\n`;
                msg += `   보유: ${p.count}개 (10개 시 +1강화)\n`;
                msg += `   스킬 파워: ${power.skillPower} / ${info.skillDesc}\n`;
            }
            msg += `─────────────────────\n!파티편성 [이름1] [이름2] [이름3] 으로 최대 3명 편성`;
            return reply(msg);
        }

        if (cmd === '!파티') {
            if (!user.activeParty || user.activeParty.length === 0) {
                return reply('❌ 편성된 파티원이 없습니다.\n!파티편성 [이름1] [이름2] [이름3] 으로 편성해주세요.');
            }
            let msg = `⚔️ [${sender}님의 파티 편성]\n─────────────────────\n`;
            for (const name of user.activeParty) {
                const p = user.partyMembers[name];
                const info = PARTY_MEMBERS[name];
                if (!p || !info) continue;
                const power = calcPartyMemberPower(name, p.level);
                msg += `[${info.grade}] ${name} +${p.level}\n`;
                msg += `   스킬 파워: ${power.skillPower}\n`;
                msg += `   ${info.skillDesc}\n`;
            }
            return reply(msg);
        }

        if (cmd === '!파티편성') {
            if (args.length < 1) return reply('❌ !파티편성 [이름1] [이름2] [이름3]\n(1~3명 지정, 공백 구분. 이름에 공백 있는 파티원도 인식됨)');
            // 스마트 파싱: args에서 순차적으로 파티원 이름 매칭
            const chosen = [];
            let idx = 0;
            while (idx < args.length && chosen.length < 3) {
                const matched = matchPartyMemberFromArgs(args, idx);
                if (!matched) return reply(`❌ "${args[idx]}" 부터 유효한 파티원 이름이 아닙니다.`);
                const name = matched.name;
                const p = user.partyMembers[name];
                if (!p || (p.count <= 0 && p.level <= 0)) return reply(`❌ "${name}" 를 보유하고 있지 않습니다.`);
                if (chosen.includes(name)) return reply(`❌ "${name}" 를 중복 편성했습니다.`);
                chosen.push(name);
                idx = matched.nextIdx;
            }
            if (idx < args.length) return reply(`❌ 파티는 최대 3명입니다. 남은 인자: ${args.slice(idx).join(' ')}`);
            user.activeParty = chosen;
            saveData(db);
            return reply(`✅ [파티 편성 완료]\n${chosen.map(n => `⚔️ ${n} +${user.partyMembers[n].level}`).join('\n')}`);
        }

        if (cmd === '!파티해제') {
            user.activeParty = [];
            saveData(db);
            return reply('✅ 파티 편성이 해제되었습니다.');
        }

        // ══════════════════════════════════════════════
        // RPG - 장비 시스템 (Phase 2)
        // ══════════════════════════════════════════════
        if (cmd === '!장비') {
            const eq = user.equipment || {};
            let hasEq = false;
            let msg = `🗡️ [${sender}님의 장착 장비]\n─────────────────────\n`;
            for (const slot of ['weapon','armor','shield','ring1','ring2']) {
                const it = eq[slot];
                if (!it) { msg += `${SLOT_LABEL[slot]}: (없음)\n`; continue; }
                hasEq = true;
                msg += `${SLOT_LABEL[slot]}: ${EQUIP_GRADE_EMOJI[it.grade]||''}${it.name} +${it.enhanceLevel||0}\n   ㄴ ${formatEquipLine(it)}\n`;
            }
            if (!hasEq) msg += '\n장착한 장비가 없습니다. !장비상점 에서 구매해보세요.\n';
            msg += `─────────────────────\n!장비인벤 — 보유 장비 목록
!장비장착 [이름or번호]`;
            return reply(msg);
        }

        if (cmd === '!장비인벤') {
            const inv = user.equipmentInventory || [];
            if (inv.length === 0) return reply('❌ 보유한 미장착 장비가 없습니다.\n!장비상자열기 또는 !장비상점 을 이용해보세요.');
            let msg = `🎒 [${sender}님의 장비 인벤토리]\n─────────────────────\n`;
            inv.forEach((it, i) => {
                const slotLabel = it.slotType === 'ring' ? '💍 반지' : SLOT_LABEL[it.slotType] || it.slotType;
                msg += `[${i+1}] ${EQUIP_GRADE_EMOJI[it.grade]||''}${it.name} +${it.enhanceLevel||0} (${slotLabel})\n   ㄴ ${formatEquipLine(it)}\n`;
            });
            msg += `─────────────────────\n!장비장착 [이름or번호] / !장비판매 [번호]`;
            return reply(msg);
        }

        if (cmd === '!장비장착') {
            if (args.length < 1) return reply('❌ !장비장착 [아이템이름or인벤번호]\n예) !장비장착 초급 무기 / !장비장착 3');
            const inv = user.equipmentInventory || [];
            if (inv.length === 0) return reply('❌ 인벤토리가 비어있습니다. !장비인벤 확인');

            let item = null, idx = -1;

            // 숫자 단독 → 인벤 번호
            const numArg = parseInt(args[0], 10);
            if (!isNaN(numArg) && args.length === 1) {
                idx = numArg - 1;
            } else {
                // 이름(부분일치 포함) — 여러 단어 조합 시도
                const query = args.join(' ').trim().toLowerCase();
                // 완전일치 우선, 그 다음 부분일치
                idx = inv.findIndex(it => it.name.toLowerCase() === query);
                if (idx === -1) idx = inv.findIndex(it => it.name.toLowerCase().includes(query));
            }

            if (idx < 0 || idx >= inv.length) return reply(`❌ 인벤에서 "${args.join(' ')}" 을(를) 찾을 수 없습니다.\n!장비인벤 으로 번호를 확인하거나, 정확한 이름을 입력하세요.`);
            item = inv[idx];

            // slotType 기준으로 자동 슬롯 결정
            let targetSlot;
            if (item.slotType === 'ring') {
                // ring1 비어있으면 ring1, 아니면 ring2, 둘 다 있으면 ring1 교체
                if (!user.equipment.ring1) targetSlot = 'ring1';
                else if (!user.equipment.ring2) targetSlot = 'ring2';
                else targetSlot = 'ring1'; // 둘 다 찼으면 ring1 교체
            } else {
                targetSlot = item.slotType; // weapon / armor / shield
            }

            inv.splice(idx, 1);
            const old = user.equipment[targetSlot];
            if (old) inv.push(old);
            user.equipment[targetSlot] = item;
            saveData(db);
            let msg = `✅ [장착 완료] ${SLOT_LABEL[targetSlot]}: ${EQUIP_GRADE_EMOJI[item.grade]||''}${item.name} +${item.enhanceLevel||0}`;
            if (item.effect) msg += `\n   ✨ 특수옵션: ${item.effect.desc}`;
            if (old) msg += `\n(기존 "${old.name}" → 인벤토리로 이동)`;
            return reply(msg);
        }

        if (cmd === '!장비해제') {
            if (args.length < 1) return reply('❌ !장비해제 [슬롯]\n(슬롯: 무기/방어구/방패/반지1/반지2)');
            const slot = SLOT_ALIASES[args[0]];
            if (!slot || slot === 'ring') return reply('❌ 슬롯은 무기/방어구/방패/반지1/반지2 중 하나여야 합니다.');
            const item = user.equipment[slot];
            if (!item) return reply(`❌ ${SLOT_LABEL[slot]}에 장착된 장비가 없습니다.`);
            user.equipment[slot] = null;
            user.equipmentInventory.push(item);
            saveData(db);
            return reply(`✅ [해제 완료] ${SLOT_LABEL[slot]}: ${item.name} → 인벤토리로 이동`);
        }

        if (cmd === '!장비판매') {
            if (args.length < 1) return reply('❌ !장비판매 [인벤번호]');
            const idx = parseInt(args[0], 10) - 1;
            const inv = user.equipmentInventory || [];
            if (isNaN(idx) || idx < 0 || idx >= inv.length) return reply('❌ 인벤번호 오류. !장비인벤 으로 확인하세요.');
            const item = inv[idx];
            const price = calcSellPrice(item);
            inv.splice(idx, 1);
            user.points += price;
            saveData(db);
            return reply(`💰 [판매 완료] ${EQUIP_GRADE_EMOJI[item.grade]||''}${item.name} +${item.enhanceLevel||0}\n획득: +${formatKRW(price)}\n잔액: ${formatKRW(user.points)}`);
        }

        if (cmd === '!장비강화') {
            if (args.length < 1) return reply('❌ !장비강화 [슬롯]\n(슬롯: 무기/방어구/방패/반지1/반지2)');
            const slot = SLOT_ALIASES[args[0]];
            if (!slot || slot === 'ring') return reply('❌ 슬롯은 무기/방어구/방패/반지1/반지2 중 하나여야 합니다.');
            const item = user.equipment[slot];
            if (!item) return reply(`❌ ${SLOT_LABEL[slot]}에 장착된 장비가 없습니다.`);
            if (item.broken) return reply('❌ 파손된 장비는 강화할 수 없습니다. !장비수리 후 시도하세요.');
            if ((item.enhanceLevel || 0) >= 10) return reply('✨ 이미 최대 강화(+10) 상태입니다.');

            const targetLevel = (item.enhanceLevel || 0) + 1;
            const cost = calcEnhanceCost(item.grade, targetLevel);
            if (user.points < cost.gold) return reply(`❌ 골드 부족 (필요: ${formatKRW(cost.gold)}, 보유: ${formatKRW(user.points)})`);
            if ((user.stones || 0) < cost.stones) return reply(`❌ 강화석 부족 (필요: ${cost.stones}개, 보유: ${user.stones || 0}개)`);

            user.points -= cost.gold;
            user.stones -= cost.stones;

            const successRate = ENHANCE_SUCCESS_RATE[targetLevel - 1] ?? 5;
            const roll = Math.random() * 100;

            let msg = `🔨 [장비강화] ${SLOT_LABEL[slot]} ${item.name} +${item.enhanceLevel} → +${targetLevel}\n`;
            msg += `소모: ${formatKRW(cost.gold)} / 강화석 ${cost.stones}개\n성공확률: ${successRate}%\n─────────────────────\n`;

            if (roll < successRate) {
                item.enhanceLevel = targetLevel;
                const eff = effectiveItemStat(item);
                const statStr = [eff.atk?`공격+${eff.atk}`:null, eff.def?`방어+${eff.def}`:null, eff.hp?`체력+${eff.hp}`:null].filter(Boolean).join(' ');
                msg += `🎉 강화 성공! +${targetLevel} 달성\n   ㄴ ${statStr}`;
            } else if (targetLevel < ENHANCE_DESTROY_START_LEVEL) {
                const before = item.enhanceLevel;
                item.enhanceLevel = Math.max(0, item.enhanceLevel - 1);
                msg += `💥 강화 실패... ${before > 0 ? `+${before} → +${item.enhanceLevel} (-1)` : '레벨 유지 (+0)'}`;
            } else {
                const destroyChance = ENHANCE_DESTROY_RATE[targetLevel] || 0;
                if (Math.random() * 100 < destroyChance) {
                    user.equipment[slot] = null;
                    msg += `💀 강화 실패! 장비가 파괴되었습니다...`;
                } else {
                    msg += `💥 강화 실패. 레벨 유지 (+${item.enhanceLevel})`;
                }
            }
            saveData(db);
            msg += `\n─────────────────────\n잔액: ${formatKRW(user.points)} / 강화석: ${user.stones}개`;
            return reply(msg);
        }

        if (cmd === '!장비상점') {
            let msg = `🏪 [장비상점 — 초급 장비 세트]\n─────────────────────\n`;
            msg += `무기 — ${formatKRW(CONFIG.equipShop.weapon)}\n`;
            msg += `방어구 — ${formatKRW(CONFIG.equipShop.armor)}\n`;
            msg += `방패 — ${formatKRW(CONFIG.equipShop.shield)}\n`;
            msg += `반지(랜덤옵션) — ${formatKRW(CONFIG.equipShop.ring)}\n`;
            msg += `─────────────────────\n!장비구매 [부위] (예: !장비구매 무기)`;
            return reply(msg);
        }

        if (cmd === '!장비구매') {
            if (args.length < 1) return reply('❌ !장비구매 [부위] (무기/방어구/방패/반지)');
            const raw = SLOT_ALIASES[args[0]];
            const slotType = (raw === 'ring1' || raw === 'ring2') ? 'ring' : raw;
            if (!slotType || !CONFIG.equipShop[slotType]) return reply('❌ 부위는 무기/방어구/방패/반지 중 하나여야 합니다.');
            const price = CONFIG.equipShop[slotType];
            if (user.points < price) return reply(`❌ 자금 부족 (필요: ${formatKRW(price)})`);
            user.points -= price;
            const item = createEquipmentItem(slotType, '초급');
            user.equipmentInventory.push(item);
            saveData(db);
            return reply(`🏪 [구매 완료] ${item.name}\n지출: -${formatKRW(price)}\n잔액: ${formatKRW(user.points)}\n\n!장비인벤 확인 후 !장비장착 으로 착용하세요.`);
        }

        if (cmd === '!장비상자목록') {
            let m = '📦 [장비상자 목록]\n─────────────────────\n';
            for (const [type, cfg] of Object.entries(CONFIG.equipmentBox)) {
                m += `${type} — ${formatKRW(cfg.price)}\n`;
            }
            m += '\n5부위(무기/방어구/방패/반지) 중 랜덤 드랍, 등급은 상자와 동일\n!장비상자구매 [종류] [수량]\n!장비상자열기 [종류] [수량]';
            return reply(m);
        }

        if (cmd === '!장비상자구매') {
            if (args.length < 1) return reply('❌ !장비상자구매 [종류] [수량(기본1)]\n(!장비상자목록 참고)');
            const boxType = args[0];
            const qty = parseInt(args[1] || '1', 10);
            if (!CONFIG.equipmentBox[boxType]) return reply(`❌ 존재하지 않는 상자: ${boxType}`);
            if (isNaN(qty) || qty < 1 || qty > 100) return reply('❌ 수량은 1~100');
            const cost = CONFIG.equipmentBox[boxType].price * qty;
            if (user.points < cost) return reply(`❌ 자금 부족 (필요: ${formatKRW(cost)})`);
            user.points -= cost;
            user.boxes[boxType] = (user.boxes[boxType] || 0) + qty;
            saveData(db);
            return reply(`📦 [구매] ${boxType} x${qty}\n지출: -${formatKRW(cost)}\n보유: ${user.boxes[boxType]}개\n잔액: ${formatKRW(user.points)}\n\n!장비상자열기 ${boxType} ${qty} 로 개봉`);
        }

        if (cmd === '!장비상자열기') {
            if (args.length < 1) return reply('❌ !장비상자열기 [종류] [수량(기본1)]');
            const boxType = args[0];
            const qty = parseInt(args[1] || '1', 10);
            if (!CONFIG.equipmentBox[boxType]) return reply(`❌ 존재하지 않는 상자: ${boxType}`);
            if (isNaN(qty) || qty < 1 || qty > 100) return reply('❌ 수량은 1~100');
            if ((user.boxes[boxType] || 0) < qty) return reply(`❌ ${boxType} 부족 (보유: ${user.boxes[boxType] || 0}개)`);

            user.boxes[boxType] -= qty;
            const results = [];
            for (let i = 0; i < qty; i++) {
                const item = rollEquipmentBox(boxType);
                if (!item) continue;
                user.equipmentInventory.push(item);
                results.push(item);
            }
            saveData(db);

            let m = `📦 [${boxType} 개봉] x${qty}\n─────────────────────\n`;
            results.forEach(it => {
                const slotLabel = it.slotType === 'weapon' ? '무기' : it.slotType === 'armor' ? '방어구' : it.slotType === 'shield' ? '방패' : '반지';
                m += `${EQUIP_GRADE_EMOJI[it.grade]||''}[${it.grade}] ${it.name} (${slotLabel})\n`;
            });
            m += `─────────────────────\n!장비인벤 에서 확인 가능`;
            return reply(m);
        }

        if (cmd === '!용병상자목록') {
            let m = '📦 [용병상자 목록]\n─────────────────────\n';
            for (const [type, cfg] of Object.entries(CONFIG.mercenaryBox)) {
                const grade = type.replace('용병상자', '');
                const name = Object.keys(PARTY_MEMBERS).find(n => PARTY_MEMBERS[n].grade === grade);
                m += `${type} — ${formatKRW(cfg.price)} (${name})\n`;
            }
            m += `\n✨ ${MERCENARY_BONUS_RATE}% 확률로 한 단계 위 등급 용병도 추가로 획득!\n!용병상자구매 [종류] [수량]\n!용병상자열기 [종류] [수량]`;
            return reply(m);
        }

        if (cmd === '!용병상자구매') {
            if (args.length < 1) return reply('❌ !용병상자구매 [종류] [수량(기본1)]\n(!용병상자목록 참고)');
            const boxType = args[0];
            const qty = parseInt(args[1] || '1', 10);
            if (!CONFIG.mercenaryBox[boxType]) return reply(`❌ 존재하지 않는 상자: ${boxType}`);
            if (isNaN(qty) || qty < 1 || qty > 100) return reply('❌ 수량은 1~100');
            const cost = CONFIG.mercenaryBox[boxType].price * qty;
            if (user.points < cost) return reply(`❌ 자금 부족 (필요: ${formatKRW(cost)})`);
            user.points -= cost;
            user.boxes[boxType] = (user.boxes[boxType] || 0) + qty;
            saveData(db);
            return reply(`📦 [구매] ${boxType} x${qty}\n지출: -${formatKRW(cost)}\n보유: ${user.boxes[boxType]}개\n잔액: ${formatKRW(user.points)}\n\n!용병상자열기 ${boxType} ${qty} 로 개봉`);
        }

        if (cmd === '!용병상자열기') {
            if (args.length < 1) return reply('❌ !용병상자열기 [종류] [수량(기본1)]');
            const boxType = args[0];
            const qty = parseInt(args[1] || '1', 10);
            if (!CONFIG.mercenaryBox[boxType]) return reply(`❌ 존재하지 않는 상자: ${boxType}`);
            if (isNaN(qty) || qty < 1 || qty > 100) return reply('❌ 수량은 1~100');
            if ((user.boxes[boxType] || 0) < qty) return reply(`❌ ${boxType} 부족 (보유: ${user.boxes[boxType] || 0}개)`);

            user.boxes[boxType] -= qty;
            const gained = {}; // name -> count
            let bonusHits = 0;
            for (let i = 0; i < qty; i++) {
                const r = rollMercenaryBox(boxType);
                if (!r) continue;
                gained[r.base] = (gained[r.base] || 0) + 1;
                if (r.bonus) {
                    gained[r.bonus] = (gained[r.bonus] || 0) + 1;
                    bonusHits++;
                }
            }
            for (const [name, cnt] of Object.entries(gained)) {
                if (!user.partyMembers[name]) user.partyMembers[name] = { count: 0, level: 0 };
                user.partyMembers[name].count += cnt;
            }
            promoteParty(user);
            saveData(db);

            let m = `📦 [${boxType} 개봉] x${qty}\n─────────────────────\n`;
            for (const [name, cnt] of Object.entries(gained)) {
                const info = PARTY_MEMBERS[name];
                const p = user.partyMembers[name];
                m += `${EQUIP_GRADE_EMOJI[info.grade]||''}[${info.grade}] ${name} x${cnt} (현재 +${p.level} / ${p.count}개)\n`;
            }
            if (bonusHits > 0) m += `\n🎊✨ 초희귀! 상위 등급 용병이 ${bonusHits}회 추가로 나왔습니다! ✨🎊`;
            return reply(m);
        }

        // ══════════════════════════════════════════════
        // RPG - 사냥터 (Phase 3)
        // ══════════════════════════════════════════════
        if (cmd === '!사냥터') {
            promoteParty(user);
            const myStat = calcCharacterStat(user);
            const myPower = calcCombatPower(myStat);
            let msg = `🏕️ [사냥터 목록] 내 전투력: ${myPower.toLocaleString()}\n─────────────────────\n`;
            for (const h of HUNTING_GROUNDS) {
                const canEnter = myPower >= h.minPower;
                const lock = canEnter ? '' : ' 🔒';
                msg += `${EQUIP_GRADE_EMOJI[h.grade]||''}[${h.grade}] ${h.name}${lock}\n`;
                msg += `   최소 ${h.minPower.toLocaleString()} / 권장 ${h.recommendedPower.toLocaleString()}\n`;
                msg += `   골드 ${formatKRW(h.goldMin)}~${formatKRW(h.goldMax)}/h / 강화석 ${h.stoneMin}~${h.stoneMax}/h\n`;
                const extras = HUNT_LOOT_EXTRA[h.name] || [];
                if (extras.length) {
                    const extraStr = extras.map(e => e.type === 'box' ? `${e.name}(${e.chance}%)` : `${e.type}(${e.chance}%)`).join(', ');
                    msg += `   추가: ${extraStr}\n`;
                }
            }
            msg += `─────────────────────\n!사냥시작 [사냥터명] / !사냥종료 / !사냥현황\n💡 최소 전투력 미달 시 입장 불가`;
            return reply(msg);
        }

        if (cmd === '!사냥시작') {
            if (args.length < 1) return reply('❌ !사냥시작 [사냥터명]\n(!사냥터 로 목록 확인)');
            const groundName = args.join(' ');
            const ground = getHuntingGround(groundName);
            if (!ground) return reply(`❌ 존재하지 않는 사냥터: ${groundName}`);

            const huntKey = `hunt:${sender}`;
            if (huntSessions[huntKey]) {
                const old = huntSessions[huntKey];
                const elap = Math.floor((Date.now() - old.startedAt) / 60000);
                return reply(`⚠️ 이미 ${old.ground.name}에서 사냥 중입니다. (${elap}분 경과)\n!사냥종료 로 귀환하세요.`);
            }

            promoteParty(user);
            const stat = calcCharacterStat(user);
            const power = calcCombatPower(stat);

            // ── 최소 전투력 미달 시 입장 차단 ──
            if (power < ground.minPower) {
                return reply(
                    `🚫 [입장 불가] ${ground.name}\n` +
                    `최소 전투력: ${ground.minPower.toLocaleString()}\n` +
                    `내 전투력: ${power.toLocaleString()}\n` +
                    `부족: ${(ground.minPower - power).toLocaleString()}\n\n` +
                    `💡 장비 강화, 용병 편성, 스킬 습득으로 전투력을 올려보세요.`
                );
            }

            const effPct = Math.round(Math.min(300, power / ground.recommendedPower * 100));
            huntSessions[huntKey] = { ground, startedAt: Date.now(), stat, power };

            return reply(
                `🏹 [사냥 시작] ${EQUIP_GRADE_EMOJI[ground.grade]||''}${ground.name}\n` +
                `내 전투력: ${power.toLocaleString()} / 권장: ${ground.recommendedPower.toLocaleString()}\n` +
                `효율: ${effPct}%${effPct < 50 ? ' ⚠️ 전투력 부족 — 효율 저하' : ''}\n` +
                `─────────────────────\n` +
                `파견 완료! 언제든 !사냥종료 로 귀환하세요.\n최대 8시간까지 전리품이 쌓입니다.`
            );
        }

        if (cmd === '!사냥현황') {
            const huntKey = `hunt:${sender}`;
            const hs = huntSessions[huntKey];
            if (!hs) return reply('❌ 현재 사냥 중이 아닙니다. !사냥시작 [사냥터명]');
            const elap = Math.floor((Date.now() - hs.startedAt) / 60000);
            const effMult = Math.min(3.0, Math.max(0.3, hs.power / hs.ground.recommendedPower));
            const estimatedGold = Math.floor((hs.ground.goldMin + hs.ground.goldMax) / 2 * effMult * (elap / 60));
            return reply(
                `🏹 [사냥 현황]\n` +
                `사냥터: ${hs.ground.name}\n` +
                `경과: ${elap}분\n` +
                `예상 골드: ~${formatKRW(estimatedGold)}\n` +
                `!사냥종료 — 귀환 + 전리품 수령`
            );
        }

        if (cmd === '!사냥종료') {
            const huntKey = `hunt:${sender}`;
            const hs = huntSessions[huntKey];
            if (!hs) return reply('❌ 현재 사냥 중이 아닙니다.');

            const elapsedMin = Math.floor((Date.now() - hs.startedAt) / 60000);
            const cappedMin = Math.min(elapsedMin, 480); // 최대 8시간

            if (cappedMin < 1) {
                const secLeft = 60 - Math.floor((Date.now() - hs.startedAt) / 1000);
                return reply(`⏳ 아직 귀환할 수 없습니다!\n최소 1분 이상 사냥 후 귀환 가능 (${secLeft}초 남음)\n계속 사냥 중...`);
            }

            delete huntSessions[huntKey]; // 최소시간 충족 후에만 삭제
            const loot = calcHuntLoot(hs.ground, cappedMin, hs.power);
            user.points += loot.gold;
            user.stones = (user.stones || 0) + loot.stones;
            user.souls  = (user.souls  || 0) + loot.souls;
            for (const [box, cnt] of Object.entries(loot.boxes)) {
                user.boxes[box] = (user.boxes[box] || 0) + cnt;
            }
            if (loot.spells && loot.spells.length > 0) {
                if (!user.spells) user.spells = [];
                for (const spId of loot.spells) user.spells.push(spId);
            }
            user.huntWins = (user.huntWins || 0) + 1;
            user.huntCount = (user.huntCount || 0) + 1;
            const evolMsgs = checkMagicEvolution(user);
            saveData(db);

            let msg = `🏕️ [사냥 귀환] ${hs.ground.name} — ${cappedMin}분\n─────────────────────\n`;
            msg += `💰 골드: +${formatKRW(loot.gold)}\n`;
            if (loot.stones > 0) msg += `💎 강화석: +${loot.stones}개\n`;
            if (loot.souls  > 0) msg += `🌌 소울: +${loot.souls}개\n`;
            if (Object.keys(loot.boxes).length > 0) {
                msg += `📦 상자:\n`;
                for (const [box, cnt] of Object.entries(loot.boxes)) msg += `   ${box} x${cnt}\n`;
            }
            if (loot.spells && loot.spells.length > 0) {
                msg += `🔮 마법서:\n`;
                const spellCounts = {};
                for (const spId of loot.spells) spellCounts[spId] = (spellCounts[spId]||0)+1;
                for (const [spId, cnt] of Object.entries(spellCounts)) {
                    const mb = getMagicBook(spId);
                    if (mb) msg += `   ${mb.element}${mb.name} × ${cnt}\n`;
                }
                if (evolMsgs.length) msg += evolMsgs.join('\n') + '\n';
            }
            if (elapsedMin > 480) msg += `⏰ 최대 8시간 초과분은 소멸됩니다.\n`;
            msg += `─────────────────────\n잔액: ${formatKRW(user.points)} / 강화석: ${(user.stones||0).toLocaleString()}개`;
            return reply(msg);
        }

        // ══════════════════════════════════════════════
        // Phase 5: 스킬북 시스템
        // ══════════════════════════════════════════════
        if (cmd === '!스킬목록') {
            let m = `📖 [스킬북 목록]\n─────────────────────\n`;
            for (const [name, sk] of Object.entries(SKILL_BOOKS)) {
                const owned = (user.skills || []).includes(name);
                m += `${EQUIP_GRADE_EMOJI[sk.grade]||''}[${sk.grade}] ${name}${owned ? ' ✅' : ''}\n`;
                m += `   ㄴ ${sk.desc}\n`;
                m += `   ㄴ 소울 ${sk.cost.souls}개 / ${formatKRW(sk.cost.gold)}\n`;
            }
            m += `─────────────────────\n!스킬습득 [스킬이름] — 구매 및 즉시 적용`;
            return reply(m);
        }

        if (cmd === '!내스킬') {
            const skills = user.skills || [];
            if (skills.length === 0) return reply('❌ 습득한 스킬이 없습니다.\n!스킬목록 으로 확인');
            let m = `📖 [${sender}님의 스킬]\n─────────────────────\n`;
            for (const name of skills) {
                const sk = SKILL_BOOKS[name];
                if (!sk) continue;
                m += `${EQUIP_GRADE_EMOJI[sk.grade]||''}${name}: ${sk.desc}\n`;
            }
            return reply(m);
        }

        if (cmd === '!스킬습득') {
            if (args.length < 1) return reply('❌ !스킬습득 [스킬이름]');
            const skillName = args.join(' ');
            const sk = SKILL_BOOKS[skillName];
            if (!sk) return reply(`❌ 존재하지 않는 스킬: ${skillName}\n!스킬목록 참고`);
            if ((user.skills || []).includes(skillName)) return reply(`❌ 이미 습득한 스킬입니다: ${skillName}`);
            if ((user.souls || 0) < sk.cost.souls) return reply(`❌ 소울 부족 (필요: ${sk.cost.souls}개, 보유: ${user.souls || 0}개)\n💡 소울은 레이드 클리어 시 획득합니다.`);
            if (user.points < sk.cost.gold) return reply(`❌ 골드 부족 (필요: ${formatKRW(sk.cost.gold)})`);
            user.souls  -= sk.cost.souls;
            user.points -= sk.cost.gold;
            if (!user.skills) user.skills = [];
            user.skills.push(skillName);
            saveData(db);
            return reply(
                `📖 [스킬 습득 완료] ${EQUIP_GRADE_EMOJI[sk.grade]||''}${skillName}\n` +
                `${sk.desc}\n소모: 소울 ${sk.cost.souls}개 / ${formatKRW(sk.cost.gold)}\n` +
                `남은 소울: ${user.souls}개\n잔액: ${formatKRW(user.points)}`
            );
        }

        // ══════════════════════════════════════════════
        // 마법 시스템
        // ══════════════════════════════════════════════
        if (cmd === '!마법목록') {
            const maxMana = calcMaxMana(user);
            let m = `🔮 [마법서 목록] (현재 마력: ${user.mana||0}/${maxMana})\n`;
            m += `─────────────────────\n`;
            const elements = ['🔥','❄️','⚡','🌑','✨'];
            const shown = new Set();
            for (const el of elements) {
                const group = MAGIC_BOOKS.filter(mb => mb.element === el);
                m += `\n${el} `;
                for (const mb of group) {
                    const owned = (user.spells||[]).filter(id => id === mb.id).length;
                    const canCast = maxMana >= mb.mana ? '' : ' 🔒';
                    const ownedStr = owned > 0 ? ` (보유:${owned})` : '';
                    m += `\n[Tier${mb.tier}] ${mb.name}${canCast}${ownedStr}\n`;
                    m += `   마력 ${mb.mana} / 피해배율 ${mb.dmgMult}x / ${mb.desc}\n`;
                    m += `   소울 ${mb.cost.souls}개 / ${formatKRW(mb.cost.gold)}\n`;
                    if (mb.evolves) { const next = getMagicBook(mb.evolves); if (next) m += `   ✨ 10개 합성 → ${next.name}\n`; }
                }
            }
            m += `─────────────────────\n!마법구매 [마법이름] — 구매 / !내마법 — 보유 목록`;
            return reply(m);
        }

        if (cmd === '!내마법') {
            const spells = user.spells || [];
            const maxMana = calcMaxMana(user);
            if (spells.length === 0) return reply(`🔮 보유한 마법이 없습니다.\n!마법목록 에서 구매하거나 사냥/레이드 드랍 노려보세요.\n현재 마력: ${user.mana||0}/${maxMana}`);
            const counts = {};
            for (const id of spells) counts[id] = (counts[id] || 0) + 1;
            let m = `🔮 [${sender}님의 마법] 마력: ${user.mana||0}/${maxMana}\n─────────────────────\n`;
            for (const [id, cnt] of Object.entries(counts)) {
                const mb = getMagicBook(id);
                if (!mb) continue;
                m += `${mb.element}[Tier${mb.tier}] ${mb.name} × ${cnt}\n`;
                m += `   마력 ${mb.mana} / ${mb.dmgMult}x / ${mb.desc}\n`;
                if (mb.evolves && cnt >= 10) { const next = getMagicBook(mb.evolves); if (next) m += `   🌟 10개 → !마법합성 으로 ${next.name} 합성 가능\n`; }
                else if (mb.evolves) { const next = getMagicBook(mb.evolves); if (next) m += `   ✨ ${10-cnt}개 더 모으면 ${next.name} 합성\n`; }
            }
            return reply(m);
        }

        if (cmd === '!마법구매') {
            if (args.length < 1) return reply('❌ !마법구매 [마법이름]');
            const mbName = args.join(' ');
            const mb = MAGIC_BOOKS.find(m => m.name === mbName);
            if (!mb) return reply(`❌ 존재하지 않는 마법: ${mbName}\n!마법목록 참고`);
            if ((user.souls || 0) < mb.cost.souls) return reply(`❌ 소울 부족 (필요: ${mb.cost.souls}개, 보유: ${user.souls||0}개)`);
            if (user.points < mb.cost.gold) return reply(`❌ 골드 부족 (필요: ${formatKRW(mb.cost.gold)})`);
            user.souls  -= mb.cost.souls;
            user.points -= mb.cost.gold;
            if (!user.spells) user.spells = [];
            user.spells.push(mb.id);
            const evolMsgs = checkMagicEvolution(user);
            saveData(db);
            let msg = `🔮 [마법서 구매] ${mb.element}${mb.name}\n${mb.desc}\n소모: 소울 ${mb.cost.souls}개 / ${formatKRW(mb.cost.gold)}\n남은 소울: ${user.souls}개`;
            if (evolMsgs.length) msg += '\n' + evolMsgs.join('\n');
            return reply(msg);
        }

        if (cmd === '!마법합성') {
            const evolMsgs = checkMagicEvolution(user);
            if (evolMsgs.length === 0) return reply('❌ 합성 가능한 마법이 없습니다. (같은 마법 10개 필요)');
            saveData(db);
            return reply(`🌟 [마법 합성 완료]\n${evolMsgs.join('\n')}`);
        }

        // ══════════════════════════════════════════════
        // Phase 6: 시즌 시스템
        // ══════════════════════════════════════════════
        if (cmd === '!시즌정보') {
            return reply(
                `🌌 [${SEASON_CONFIG.name}]\n─────────────────────\n` +
                `기간: ${SEASON_CONFIG.startDate} ~ ${SEASON_CONFIG.endDate}\n\n` +
                `🏆 시즌 보상 (종료 시 합랭킹 기준)\n` +
                SEASON_CONFIG.rewards.map(r =>
                    `TOP${r.rank}: ${r.title}\n   골드 ${formatKRW(r.gold)} / 강화석 ${r.stones} / 소울 ${r.souls}`
                ).join('\n') +
                `\n─────────────────────\n!합랭킹 으로 현재 순위 확인`
            );
        }

        if (cmd === '!관리자시즌종료') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            // 합랭킹 기준 보상 지급
            const all = Object.keys(db).filter(n => {
                if (!userExists(db, n)) return false;
                const u = ensureUser(db, n);
                promoteParty(u);
                return true;
            });
            const ranked = all.map(n => {
                const u = ensureUser(db, n);
                const stat = calcCharacterStat(u);
                const power = calcCombatPower(stat);
                const nw = calcNetWorth(u);
                return { name: n, score: nw.total + power * 1000 };
            }).sort((a,b) => b.score - a.score);

            let log = `🌌 [시즌 종료] ${SEASON_CONFIG.name}\n─────────────────────\n`;
            for (const reward of SEASON_CONFIG.rewards) {
                const recipients = ranked.filter((r, i) => i < reward.rank && (SEASON_CONFIG.rewards.find(rw => rw.rank < reward.rank)?.rank || 0) <= i);
                for (const r of recipients) {
                    const u = ensureUser(db, r.name);
                    u.points += reward.gold;
                    u.stones = (u.stones || 0) + reward.stones;
                    u.souls  = (u.souls  || 0) + reward.souls;
                    if (!u.specialTitles) u.specialTitles = [];
                    if (!u.specialTitles.includes(reward.title)) u.specialTitles.push(reward.title);
                    log += `${reward.title} → ${r.name}\n`;
                }
            }
            saveData(db);
            log += `\n총 ${ranked.length}명에게 시즌 보상 지급 완료`;
            return reply(log);
        }

        if (cmd === '!장비수리') {
            if (args.length < 1) return reply('❌ !장비수리 [슬롯]\n(슬롯: 무기/방어구/방패/반지1/반지2)');
            const slot = SLOT_ALIASES[args[0]];
            if (!slot || slot === 'ring') return reply('❌ 슬롯은 무기/방어구/방패/반지1/반지2 중 하나여야 합니다.');
            const item = user.equipment[slot];
            if (!item) return reply(`❌ ${SLOT_LABEL[slot]}에 장착된 장비가 없습니다.`);
            if (!item.broken) return reply(`✅ ${SLOT_LABEL[slot]}의 장비는 파손되지 않았습니다.`);
            const cost = calcRepairCost(item.grade);
            if (user.points < cost) return reply(`❌ 수리비 부족 (필요: ${formatKRW(cost)})`);
            user.points -= cost;
            item.broken = false;
            saveData(db);
            return reply(`🔧 [수리 완료] ${SLOT_LABEL[slot]}: ${item.name}\n지출: -${formatKRW(cost)}\n잔액: ${formatKRW(user.points)}`);
        }

        if (cmd === '!장비수리전체') {
            const brokenSlots = ['weapon','armor','shield','ring1','ring2'].filter(s => user.equipment[s] && user.equipment[s].broken);
            if (brokenSlots.length === 0) return reply('✅ 파손된 장비가 없습니다.');
            let totalCost = 0;
            for (const s of brokenSlots) totalCost += calcRepairCost(user.equipment[s].grade);
            if (user.points < totalCost) return reply(`❌ 수리비 부족 (필요: ${formatKRW(totalCost)}, 파손 ${brokenSlots.length}개)`);
            user.points -= totalCost;
            for (const s of brokenSlots) user.equipment[s].broken = false;
            saveData(db);
            return reply(`🔧 [전체 수리 완료] ${brokenSlots.length}개 장비 수리\n지출: -${formatKRW(totalCost)}\n잔액: ${formatKRW(user.points)}`);
        }

        // ══════════════════════════════════════════════
        // RPG - 레이드 (Phase 4) — 턴제 보스전
        // ══════════════════════════════════════════════
        if (cmd === '!레이드목록' || cmd === '!보스목록') {
            promoteParty(user);
            const myStat2 = calcCharacterStat(user);
            const myPower2 = calcCombatPower(myStat2);
            let m = `👹 [레이드 보스 목록] 내 전투력: ${myPower2.toLocaleString()}\n─────────────────────\n`;
            for (const b of RAID_BOSSES) {
                const killed = (user.bossKills && user.bossKills[b.name]) || 0;
                const killMark = killed > 0 ? ` ✅(${killed}킬)` : '';
                const canEnter = myPower2 >= b.minPower;
                const lock = canEnter ? '' : ' 🔒';
                m += `${EQUIP_GRADE_EMOJI[b.grade]||''}[${b.grade}] ${b.name}${killMark}${lock}\n`;
                m += `   최소 ${b.minPower.toLocaleString()} / 권장 ${b.recommendedPower.toLocaleString()}\n`;
                m += `   HP:${b.maxHp.toLocaleString()} 공격:${b.atk} 방어:${b.def}\n`;
                m += `   보상: 골드 ${formatKRW(b.gold)} / 강화석 ${b.stones} / 소울 ${b.souls}\n`;
            }
            m += `─────────────────────\n!레이드 [보스이름] — 레이드 시작\n🔒 = 최소 전투력 미달 (입장 불가)`;
            return reply(m);
        }

        if (cmd === '!레이드') {
            if (args.length < 1) return reply('❌ !레이드 [보스이름]\n(!레이드목록 으로 보스 확인)');

            // 파손 장비 확인
            const brokenSlots2 = ['weapon','armor','shield','ring1','ring2'].filter(s => user.equipment[s] && user.equipment[s].broken);
            if (brokenSlots2.length > 0 && !args.includes('강행')) {
                const list = brokenSlots2.map(s => `💔 ${SLOT_LABEL[s]}: ${user.equipment[s].name}`).join('\n');
                return reply(
                    `⚠️ 파손된 장비가 있습니다!\n${list}\n\n` +
                    `!장비수리전체 로 수리하거나\n!레이드 ${args.filter(a=>a!=='강행').join(' ')} 강행 으로 파손 상태로 진행\n(파손 장비 스탯은 0으로 적용)`
                );
            }

            const bossName = args.filter(a => a !== '강행').join(' ');
            const boss = getRaidBoss(bossName);
            if (!boss) return reply(`❌ 존재하지 않는 보스: ${bossName}\n(!레이드목록 참고)`);

            promoteParty(user);
            const stat = calcCharacterStat(user);
            const power = calcCombatPower(stat);

            // ── 최소 전투력 미달 시 입장 차단 ──
            if (power < boss.minPower) {
                return reply(
                    `🚫 [입장 불가] ${boss.name}\n` +
                    `최소 전투력: ${boss.minPower.toLocaleString()}\n` +
                    `내 전투력: ${power.toLocaleString()}\n` +
                    `부족: ${(boss.minPower - power).toLocaleString()}\n\n` +
                    `💡 장비 강화, 용병 편성, 스킬 습득으로 전투력을 올려보세요.`
                );
            }

            const raidCooldown = 120 * 1000;
            const raidRemain = raidCooldown - (Date.now() - (user.lastRaidAt || 0));
            if (raidRemain > 0) return reply(`⏳ 레이드 쿨타임: ${Math.ceil(raidRemain/1000)}초 후 재시도 가능`);

            user.lastRaidAt = Date.now();
            saveData(db);

            // 같은 방에 다른 레이드 진행 중인지 확인
            const roomRaids = Object.entries(raidSessions)
                .filter(([k, s]) => k.startsWith(`${room}:`) && s.sender !== sender && Date.now() - (s.lastActionAt || 0) < 60000);
            let otherRaidMsg = '';
            if (roomRaids.length > 0) {
                otherRaidMsg = `ℹ️ 현재 방에서 레이드 중: ${roomRaids.map(([,s]) => `${s.sender}(${s.boss.name})`).join(', ')}\n`;
            }

            const sessionKey = `${room}:${sender}`;
            const maxMana = calcMaxMana(user);
            raidSessions[sessionKey] = {
                boss,
                bossHp: boss.maxHp,
                maxHp: stat.maxHp,
                hp: stat.maxHp,
                turn: 0,
                enraged: false,
                sender,
                room,
                stat,
                startedAt: Date.now(),
                lastActionAt: Date.now(),
                pendingPattern: null,
                mana: maxMana,
                maxMana,
                bossDebuffs: [],    // { type, turns, value }
                playerBarrier: 0,   // 남은 배리어 턴
                nextCritGuaranteed: false,
            };

            let m = `⚔️ [레이드 시작] ${EQUIP_GRADE_EMOJI[boss.grade]||''}${boss.name}\n`;
            m += `${boss.desc}\n`;
            if (otherRaidMsg) m += otherRaidMsg;
            m += `─────────────────────\n`;
            m += `👹 보스\n`;
            m += `${hpBar(boss.maxHp, boss.maxHp)} / 공격:${boss.atk} 방어:${boss.def}\n`;
            m += `⚠️ HP ${Math.floor(boss.enrageHp*100)}% 이하 광폭화 (공격력 ×${boss.enrageAtkMult})\n`;
            m += `─────────────────────\n`;
            m += `❤️ 내 HP\n`;
            m += `${hpBar(stat.maxHp, stat.maxHp)} / 전투력: ${power.toLocaleString()}\n`;
            if (user.activeParty.length > 0) m += `👥 파티: ${user.activeParty.join(', ')}\n`;
            m += `─────────────────────\n`;
            m += `!공격 — 기본 공격\n`;
            m += `!강공 — 강력 공격 (보스 노출 패턴 시 최대 효율)\n`;
            m += `!방어 — 이번 턴 피해 40% 감소\n`;
            m += `!회피 — 이번 턴 피해 무력화 시도\n`;
            m += `!방해 — 보스 회복/버프 차단\n`;
            m += `!마법 — 마법 시전 (마력 ${session.mana||0}/${session.maxMana||20}) 자동 최강 선택\n`;
            m += `!후퇴 — 레이드 포기\n`;
            m += `💡 보스 예고 패턴에 맞는 액션을 선택하면 보너스!`;
            return reply(m);
        }

        // 레이드 중 행동 명령어 (확장: !공격 !강공 !방어 !회피 !방해 !후퇴)
        if (['!공격','!강공','!방어','!회피','!방해','!마법','!후퇴'].includes(cmd)) {
            const sessionKey = `${room}:${sender}`;
            const session = raidSessions[sessionKey];

            // 1분 타임아웃: 다른 사람 세션 만료 체크도 겸용
            for (const [key, s] of Object.entries(raidSessions)) {
                if (Date.now() - (s.lastActionAt || s.startedAt || 0) > 60000) {
                    delete raidSessions[key];
                }
            }

            if (!session) return reply('❌ 진행 중인 레이드가 없습니다. !레이드 [보스이름] 으로 시작하세요.');

            if (cmd === '!후퇴') {
                delete raidSessions[sessionKey];
                return reply('🏳️ 레이드에서 후퇴했습니다. (쿨타임 없이 재시도 가능)');
            }

            session.turn++;
            session.lastActionAt = Date.now();

            // 행동 → 내부 액션 문자열
            // 마법 사용 처리
            if (cmd === '!마법') {
                const spells = user.spells || [];
                if (spells.length === 0) return reply('❌ 보유한 마법이 없습니다.\n!마법목록 으로 구매하거나 사냥/레이드에서 드랍을 노려보세요.');
                // 현재 마력으로 시전 가능한 마법 중 가장 강한 것 자동 선택
                const usable = spells
                    .map(id => getMagicBook(id))
                    .filter(m => m && (session.mana || 0) >= m.mana)
                    .sort((a, b) => b.mana - a.mana);
                if (usable.length === 0) {
                    return reply(`❌ 마력 부족! (보유: ${session.mana}/${session.maxMana})\n마력은 매 턴 1씩 회복됩니다.`);
                }
                const spell = usable[0];
                // 인벤에서 1개 소모
                const idx = user.spells.indexOf(spell.id);
                user.spells.splice(idx, 1);
                session.mana -= spell.mana;
                // 마법 피해 계산 (공격력 × 배율)
                const turnStat2 = { ...session.stat };
                const magicDmg = Math.floor(turnStat2.atk * spell.dmgMult);
                // 소멸(doom) — 현재 보스 HP의 15% 추가
                const doomBonus = spell.effect === 'doom' ? Math.floor(session.bossHp * 0.15) : 0;
                // 신의 심판 — 광폭화 시 2배
                const holyMult = (spell.effect === 'holy_full' && session.enraged) ? 2 : 1;
                const totalSpellDmg = (magicDmg + doomBonus) * holyMult;
                session.bossHp = Math.max(0, session.bossHp - totalSpellDmg);
                const spellLog = [`${spell.element} [${spell.name}] 시전! ${totalSpellDmg} 마법 피해${doomBonus>0?' (+소멸 추가)':''}${holyMult>1?' (광폭화 2배)':''}`];
                applyMagicEffect(spell, session, spellLog);
                if (session.bossHp <= 0) {
                    saveData(db);
                    user.bossKills = user.bossKills || {};
                    user.bossKills[session.boss.name] = (user.bossKills[session.boss.name] || 0) + 1;
                    user.points  += session.boss.gold;
                    user.stones   = (user.stones || 0) + session.boss.stones;
                    user.souls    = (user.souls  || 0) + session.boss.souls;
                    const evolMsgs = checkMagicEvolution(user);
                    saveData(db);
                    delete raidSessions[`${room}:${sender}`];
                    let m = `${spell.element} [${spell.name}] 시전!\n`;
                    m += spellLog.join('\n') + '\n';
                    m += `─────────────────────\n`;
                    m += `👹 ${session.boss.name}\n${hpBar(0, session.boss.maxHp, session.enraged)}\n`;
                    m += `\n🎉🎊 [${session.boss.name} 처치!]\n`;
                    m += `보상: 골드 +${formatKRW(session.boss.gold)} / 강화석 +${session.boss.stones} / 소울 +${session.boss.souls}\n`;
                    m += `누적 처치: ${user.bossKills[session.boss.name]}회`;
                    if (evolMsgs.length) m += '\n' + evolMsgs.join('\n');
                    return reply(m);
                }
                // 보스 반격 (마법 사용 턴은 방어 없음)
                const bossAtk2 = Math.floor(session.boss.atk * (session.enraged ? session.boss.enrageAtkMult : 1));
                const isFrozen2 = session.bossDebuffs.some(d => d.type === 'freeze');
                if (!isFrozen2) {
                    session.hp -= bossAtk2;
                    spellLog.push(`👹 보스: ${bossAtk2} 피해`);
                } else {
                    spellLog.push(`❄️ 빙결! 보스 공격 봉인`);
                }
                const nextPat = Math.random() < 0.35 ? rollBossPattern() : null;
                if (nextPat) { session.pendingPattern = nextPat; spellLog.push(`\n⚠️ ${nextPat.announce}`); }
                session.turn++;
                session.lastActionAt = Date.now();
                const evolMsgsM = checkMagicEvolution(user);
                saveData(db);
                if (session.hp <= 0) {
                    const equipped = ['weapon','armor','shield','ring1','ring2'].filter(s => user.equipment[s] && !user.equipment[s].broken);
                    if (equipped.length > 0) { const sl = equipped[Math.floor(Math.random()*equipped.length)]; user.equipment[sl].broken = true; spellLog.push(`💥 패널티: "${user.equipment[sl].name}" 파손!`); }
                    delete raidSessions[`${room}:${sender}`]; saveData(db);
                }
                let m = `${spell.element} [마법: ${spell.name}] 턴 ${session.turn}\n─────────────────────\n`;
                m += spellLog.join('\n') + '\n';
                m += `─────────────────────\n`;
                m += `👹 ${session.boss.name}${session.enraged?' 💢':''}\n${hpBar(session.bossHp, session.boss.maxHp, session.enraged)}\n`;
                m += `❤️ 내 HP\n${hpBar(Math.max(0,session.hp), session.maxHp)}\n`;
                m += `💧 마력: ${session.mana}/${session.maxMana}\n`;
                if (evolMsgsM.length) m += evolMsgsM.join('\n') + '\n';
                m += session.hp <= 0 ? '\n💀 [전투 패배]' : `\n👉 !공격 !강공 !방어 !회피 !방해 !마법 !후퇴  (⏱️ 1분)`;
                return reply(m);
            }

            const actionMap = { '!공격': '공격', '!강공': '강공', '!방어': '방어', '!회피': '회피', '!방해': '방해' };
            const action = actionMap[cmd] || '공격';

            // 방어 자세 적용 (이전 턴에 !방어를 선택했을 경우 — 이제 매턴 바로 적용으로 통합)
            const turnStat = { ...session.stat };

            const { log, result } = raidTurn(user, session, turnStat, action);

            const actionLabel = { 공격: '⚔️ 공격', 강공: '💥 강공', 방어: '🛡️ 방어', 회피: '💨 회피', 방해: '🚫 방해' }[action] || '⚔️';
            let m = `⚔️ [${session.boss.name}] 턴 ${session.turn} — ${actionLabel}\n`;
            m += `─────────────────────\n`;
            m += log.join('\n') + '\n';
            m += `─────────────────────\n`;
            m += `👹 ${session.boss.name}${session.enraged ? ' 💢' : ''}\n`;
            m += `${hpBar(session.bossHp, session.boss.maxHp, session.enraged)}\n`;
            m += `❤️ 내 HP\n`;
            m += `${hpBar(session.hp, session.maxHp)}\n`;
            m += `💧 마력: ${session.mana||0}/${session.maxMana||20}\n`;

            if (result === 'win') {
                delete raidSessions[sessionKey];
                user.bossKills = user.bossKills || {};
                user.bossKills[session.boss.name] = (user.bossKills[session.boss.name] || 0) + 1;
                user.points  += session.boss.gold;
                user.stones   = (user.stones || 0) + session.boss.stones;
                user.souls    = (user.souls  || 0) + session.boss.souls;
                // 레이드 보스 등급에 따른 마법서 드랍 (25% 확률)
                let raidSpellDrop = null;
                if (Math.random() < 0.25) {
                    const bossGradeIdx = EQUIP_GRADES.indexOf(session.boss.grade);
                    const spellTier = Math.min(4, Math.max(1, Math.ceil((bossGradeIdx + 1) / 2)));
                    const spellId = rollSpellDrop(spellTier);
                    if (spellId) { if (!user.spells) user.spells = []; user.spells.push(spellId); raidSpellDrop = getMagicBook(spellId); }
                }
                const evolMsgsR = checkMagicEvolution(user);
                saveData(db);
                m += `\n🎉🎊 [${session.boss.name} 처치!]\n`;
                m += `보상: 골드 +${formatKRW(session.boss.gold)} / 강화석 +${session.boss.stones} / 소울 +${session.boss.souls}\n`;
                if (raidSpellDrop) m += `🔮 마법서 드랍: ${raidSpellDrop.element}${raidSpellDrop.name} (Tier${raidSpellDrop.tier})\n`;
                if (evolMsgsR.length) m += evolMsgsR.join('\n') + '\n';
                m += `누적 처치: ${user.bossKills[session.boss.name]}회`;
            } else if (result === 'lose') {
                delete raidSessions[sessionKey];
                const equipped = ['weapon','armor','shield','ring1','ring2'].filter(s => user.equipment[s] && !user.equipment[s].broken);
                let brokenName = null;
                if (equipped.length > 0) {
                    const slot = equipped[Math.floor(Math.random() * equipped.length)];
                    user.equipment[slot].broken = true;
                    brokenName = user.equipment[slot].name;
                }
                saveData(db);
                m += `\n💀 [전투 패배]\n`;
                if (brokenName) m += `💥 패널티: "${brokenName}" 이(가) 파손!\n!장비수리 로 복구하세요.`;
                else m += `(장착 장비 없음 — 패널티 없음)`;
            } else {
                if (session.pendingPattern) {
                    m += `\n👉 !공격 !강공 !방어 !회피 !방해 !마법 !후퇴  (⏱️ 1분)`;
                } else {
                    m += `\n👉 !공격 !강공 !방어 !회피 !방해 !마법 !후퇴  (⏱️ 1분)`;
                }
            }
            return reply(m);
        }

        if (cmd === '!레이드현황') {
            const sessionKey = `${room}:${sender}`;
            const session = raidSessions[sessionKey];
            if (!session) {
                // 이 방에 다른 사람 레이드가 있는지 확인
                const roomRaids = Object.entries(raidSessions)
                    .filter(([k, s]) => k.startsWith(`${room}:`) && Date.now() - (s.lastActionAt || 0) < 60000);
                if (roomRaids.length > 0) {
                    const info = roomRaids.map(([,s]) => `${s.sender} vs ${s.boss.name} (턴${s.turn})\n${hpBar(s.bossHp, s.boss.maxHp, s.enraged)}`).join('\n');
                    return reply(`👀 [현재 레이드 중]\n─────────────────────\n${info}`);
                }
                return reply('❌ 진행 중인 레이드가 없습니다.');
            }
            const idleSec = Math.floor((Date.now() - (session.lastActionAt || 0)) / 1000);
            const timeoutWarn = idleSec > 40 ? `\n⚠️ ${60 - idleSec}초 후 자동 후퇴!` : '';
            let m = `⚔️ [레이드 현황] ${session.boss.name} — 턴 ${session.turn}\n`;
            m += `👹 보스${session.enraged ? ' 💢광폭화' : ''}\n`;
            m += `${hpBar(session.bossHp, session.boss.maxHp, session.enraged)}\n`;
            m += `❤️ 내 HP\n`;
            m += `${hpBar(session.hp, session.maxHp)}${timeoutWarn}\n`;
            if (session.pendingPattern) m += `⚠️ ${session.pendingPattern.announce}\n`;
            m += `!공격 !강공 !방어 !회피 !방해 !마법 !후퇴`;
            return reply(m);
        }

        if (cmd === '!내스탯' || cmd === '!스탯') {
            promoteParty(user);
            saveData(db);
            const stat = calcCharacterStat(user);
            const power = calcCombatPower(stat);
            let msg = `⚔️ [${sender}님의 캐릭터 스탯]\n━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `❤️ HP: ${stat.maxHp.toLocaleString()}\n`;
            msg += `🗡️ 공격력: ${stat.atk.toLocaleString()}\n`;
            msg += `🛡️ 방어력: ${stat.def.toLocaleString()}\n`;
            msg += `🔥 전투력: ${power.toLocaleString()}\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `💰 골드: ${formatKRW(user.points)}\n`;
            msg += `💎 강화석: ${(user.stones||0).toLocaleString()}개\n`;
            msg += `🌌 소울: ${(user.souls||0).toLocaleString()}개\n`;
            msg += `💧 마력: ${calcMaxMana(user)} (장비 보너스 +${calcManaFromEquip(user.equipment).mana})\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━\n`;
            const spellCount = (user.spells||[]).length;
            if (spellCount > 0) {
                const counts = {};
                for (const id of user.spells) counts[id] = (counts[id]||0)+1;
                msg += `🔮 마법: ${Object.entries(counts).map(([id,c]) => { const m=getMagicBook(id); return m?`${m.element}${m.name}×${c}`:`?×${c}`; }).join(' ')}\n`;
            }
            msg += `━━━━━━━━━━━━━━━━━━━━\n`;
            const eq = user.equipment || {};
            let hasEq = false;
            let hasBroken = false;
            for (const slot of ['weapon','armor','shield','ring1','ring2']) {
                if (eq[slot]) {
                    hasEq = true;
                    const it = eq[slot];
                    if (it.broken) hasBroken = true;
                    msg += `${SLOT_LABEL[slot]}: ${EQUIP_GRADE_EMOJI[it.grade]||''}${it.name} +${it.enhanceLevel||0}${it.broken?' 💔[파손]':''}\n`;
                }
            }
            if (!hasEq) msg += '(장착한 장비 없음 — !장비상점 에서 구매해보세요)\n';
            if (hasBroken) msg += '⚠️ 파손된 장비가 있습니다. !장비수리 로 복구하세요.\n';
            msg += `━━━━━━━━━━━━━━━━━━━━\n`;
            if (user.activeParty && user.activeParty.length > 0) {
                msg += `⚔️ 파티: ${user.activeParty.map(n => `${n} +${user.partyMembers[n].level}`).join(' / ')}`;
            } else {
                msg += `⚔️ 파티: 편성 없음 (!파티편성)`;
            }
            return reply(msg);
        }

        if (cmd === '!내상자') {
            const boxes = user.boxes||{};
            const has = Object.entries(boxes).filter(([,n])=>n>0);
            if (has.length===0) return reply('❌ 보유한 상자가 없습니다. !상자목록 으로 구매해보세요.');
            let msg=`📦 [${sender}님의 상자]\n─────────────────────\n`;
            for (const [type,cnt] of has) msg+=`${type}: ${cnt}개\n`;
            msg+='─────────────────────\n!상자열기 [종류] [수량] 으로 개봉';
            return reply(msg);
        }

        // ══════════════════════════════════════════════
        // 랭킹
        // ══════════════════════════════════════════════
        // ══════════════════════════════════════════════
        // 랭킹 (자산/스탯/합)
        // ══════════════════════════════════════════════
        if (cmd === '!랭킹') {
            return reply(
                '🏆 [랭킹 선택]\n─────────────────────\n' +
                '!자산랭킹 — 총 자산 순위 (골드+코인)\n' +
                '!스탯랭킹 — 캐릭터 전투력 순위 (공격+방어+HP)\n' +
                '!합랭킹 — 자산+전투력 종합 순위\n' +
                '─────────────────────\n' +
                '💡 각각 상위 10명까지 표시됩니다.'
            );
        }

        if (cmd === '!자산랭킹') {
            const all = Object.keys(db).filter(n => userExists(db, n));
            const ranked = all
                .map(n => { const u = ensureUser(db, n); return { name: n, total: calcNetWorth(u).total }; })
                .filter(r => r.total > 0)
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);
            if (ranked.length === 0) return reply('❌ 자산이 있는 유저가 없습니다.');
            const medals = ['🥇', '🥈', '🥉'];
            let board = '💰 [자산 랭킹 TOP 10]\n─────────────────────\n';
            ranked.forEach((r, i) => {
                const u = ensureUser(db, r.name);
                const title = displayName(u, r.name);
                board += `${medals[i] || `${i + 1}.`} ${title}\n   ${formatKRW(r.total)}\n`;
            });
            return reply(board);
        }

        if (cmd === '!스탯랭킹') {
            const all = Object.keys(db).filter(n => userExists(db, n));
            const ranked = all
                .map(n => {
                    const u = ensureUser(db, n);
                    promoteParty(u);
                    const stat = calcCharacterStat(u);
                    // 전투력 공식: 공격력×2 + 방어력×3 + HP×0.5
                    const power = Math.floor(stat.atk * 2 + stat.def * 3 + stat.maxHp * 0.5);
                    return { name: n, atk: stat.atk, def: stat.def, hp: stat.maxHp, power };
                })
                .filter(r => r.power > 0)
                .sort((a, b) => b.power - a.power)
                .slice(0, 10);
            if (ranked.length === 0) return reply('❌ 전투력 있는 유저가 없습니다.');
            const medals = ['🥇', '🥈', '🥉'];
            let board = '⚔️ [스탯 랭킹 TOP 10]\n─────────────────────\n';
            ranked.forEach((r, i) => {
                const u = ensureUser(db, r.name);
                const title = displayName(u, r.name);
                board += `${medals[i] || `${i + 1}.`} ${title}\n   전투력 ${r.power.toLocaleString()} (⚔️${r.atk.toLocaleString()} 🛡️${r.def.toLocaleString()} ❤️${r.hp.toLocaleString()})\n`;
            });
            return reply(board);
        }

        if (cmd === '!합랭킹' || cmd === '!종합랭킹') {
            const all = Object.keys(db).filter(n => userExists(db, n));
            // 자산과 전투력을 정규화해서 합산 (0~1000 스케일)
            const dataArr = all.map(n => {
                const u = ensureUser(db, n);
                promoteParty(u);
                const stat = calcCharacterStat(u);
                const power = Math.floor(stat.atk * 2 + stat.def * 3 + stat.maxHp * 0.5);
                const asset = calcNetWorth(u).total;
                return { name: n, power, asset };
            });
            const maxAsset = Math.max(1, ...dataArr.map(d => d.asset));
            const maxPower = Math.max(1, ...dataArr.map(d => d.power));
            const ranked = dataArr
                .map(d => {
                    const assetScore = (d.asset / maxAsset) * 500;
                    const powerScore = (d.power / maxPower) * 500;
                    return { ...d, combined: Math.floor(assetScore + powerScore) };
                })
                .filter(r => r.combined > 0)
                .sort((a, b) => b.combined - a.combined)
                .slice(0, 10);
            if (ranked.length === 0) return reply('❌ 랭킹에 오를 유저가 없습니다.');
            const medals = ['🥇', '🥈', '🥉'];
            let board = '🌟 [종합 랭킹 TOP 10]\n─────────────────────\n';
            ranked.forEach((r, i) => {
                const u = ensureUser(db, r.name);
                const title = displayName(u, r.name);
                board += `${medals[i] || `${i + 1}.`} ${title}\n   종합 ${r.combined}점 | 자산 ${formatKRW(r.asset)} | 전투력 ${r.power.toLocaleString()}\n`;
            });
            board += '─────────────────────\n💡 자산과 전투력을 각 500점 만점으로 환산한 종합점수입니다.';
            return reply(board);
        }

        // ══════════════════════════════════════════════
        // 송금
        // ══════════════════════════════════════════════
        if (cmd === '!송금') {
            if (args.length<2) return reply('❌ !송금 [닉네임] [금액 or 전재산]');
            const target=args[0];
            const amt=args[1]==='전재산'?user.points:parseAmount(args[1]);
            if (isNaN(amt)||amt<=0||sender===target||user.points<amt||!userExists(db,target))
                return reply(`❌ 송금 실패. (보유: ${formatKRW(user.points)})`);
            const recv=ensureUser(db,target);
            user.points-=amt; recv.points+=amt;
            saveData(db);
            return reply(`💸 [송금 완료]\n대상: ${target}\n금액: -${formatKRW(amt)}\n내 잔액: ${formatKRW(user.points)}`);
        }

        // ══════════════════════════════════════════════
        // ══════════════════════════════════════════════
        // 코인 시세 / 매수 / 매도
        // ══════════════════════════════════════════════
        if (cmd === '!코인시세') {
            let m = '📈 [코인 시세]\n─────────────────────\n';
            for (const [name, info] of Object.entries(COIN_MARKET)) {
                const diff = info.currentPrice - info.lastPrice;
                m += `🪙 ${name}: ${formatKRW(info.currentPrice)} (${diff>=0?'🔺+':'🔻'}${formatKRW(Math.abs(diff))})\n`;
            }
            m += `\n다음 시세 변동까지 최대 ${CONFIG.coin.updateIntervalMinutes}분`;
            return reply(m);
        }

        if (cmd === '!매수' || cmd === '!매도') {
            const isBuy = cmd === '!매수';
            if (args.length<2) return reply(`❌ 양식: !${isBuy?'매수':'매도'} [코인명] [금액or수량or풀]`);
            const coinName = args[0];
            if (!COIN_MARKET[coinName]) return reply('❌ 존재하지 않는 코인입니다.');
            const price = COIN_MARKET[coinName].currentPrice;
            if (!user.coins[coinName]) user.coins[coinName]={count:0,avgPrice:0};
            const h = user.coins[coinName];

            let amount;
            const arg = args[1];
            if (isFullKeyword(arg)) {
                amount = isBuy ? Math.floor(user.points/price) : h.count;
            } else {
                const parsed = parseAmount(arg);
                if (isNaN(parsed)) return reply('❌ 수량 또는 금액을 입력하세요.');
                const hasUnit = /[만억조]/.test(arg);
                if (hasUnit) amount = Math.floor(parsed / price);
                else amount = parsed;
            }

            if (isNaN(amount)||amount<=0) return reply(isBuy?`❌ 매수 가능 수량 없음 (보유: ${formatKRW(user.points)})`:'❌ 매도할 수량 없음');

            if (isBuy) {
                const cost = price*amount;
                if (user.points<cost) return reply(`❌ 자금 부족. 필요: ${formatKRW(cost)}`);
                user.points -= cost;
                updateAvgBuy(h, amount, price);
                saveData(db);
                return reply(`🪙 [매수]\n${coinName} ${amount.toLocaleString()}개\n단가 ${formatKRW(price)} / 총 -${formatKRW(cost)}\n평단 ${formatKRW(h.avgPrice)}\n잔액: ${formatKRW(user.points)}`);
            } else {
                if (h.count<amount) return reply(`❌ 보유 부족 (보유: ${h.count.toLocaleString()}개)`);
                const ret = price*amount;
                h.count -= amount;
                if (h.count===0) h.avgPrice=0;
                user.points += ret;
                saveData(db);
                return reply(`📉 [매도]\n${coinName} ${amount.toLocaleString()}개\n단가 ${formatKRW(price)} / 총 +${formatKRW(ret)}\n잔액: ${formatKRW(user.points)}`);
            }
        }

        // ══════════════════════════════════════════════
        // 직원 목록 / 채용 / 수익 / 해고
        // ══════════════════════════════════════════════
        // ══════════════════════════════════════════════
        // 상자 시스템
        // ══════════════════════════════════════════════
        if (cmd === '!상자목록') {
            let m = '📦 [랜덤상자 목록]\n─────────────────────\n';
            for (const [type, cfg] of Object.entries(CONFIG.gacha)) {
                m += `${type} — ${formatKRW(cfg.price)}\n`;
                const rateStr = Object.entries(cfg.rates)
                    .filter(([,v])=>v>0)
                    .map(([g,v])=>`${g} ${v}%`).join(', ');
                m += `   ㄴ ${rateStr}\n`;
            }
            m += '\n!상자구매 [종류] [수량]\n!상자열기 [종류] [수량]';
            return reply(m);
        }

        if (cmd === '!상자구매') {
            if (args.length<1) return reply('❌ !상자구매 [종류] [수량(기본1)]');
            const boxType = args[0];
            const qty = parseInt(args[1]||'1',10);
            if (!CONFIG.gacha[boxType]) return reply(`❌ 존재하지 않는 상자: ${boxType}`);
            if (isNaN(qty)||qty<1||qty>100) return reply('❌ 수량은 1~100');
            const cost = CONFIG.gacha[boxType].price * qty;
            if (user.points<cost) return reply(`❌ 자금 부족 (필요: ${formatKRW(cost)})`);
            user.points -= cost;
            user.boxes[boxType] = (user.boxes[boxType]||0) + qty;
            saveData(db);
            return reply(`📦 [구매] ${boxType} x${qty}\n지출: -${formatKRW(cost)}\n보유: ${user.boxes[boxType]}개\n잔액: ${formatKRW(user.points)}\n\n!상자열기 ${boxType} ${qty} 로 개봉`);
        }

        if (cmd === '!상자열기') {
            if (args.length<1) return reply('❌ !상자열기 [종류] [수량(기본1)]');
            const boxType = args[0];
            const qty = parseInt(args[1]||'1',10);
            if (!CONFIG.gacha[boxType]) return reply(`❌ 존재하지 않는 상자: ${boxType}`);
            if (isNaN(qty)||qty<1||qty>100) return reply('❌ 수량은 1~100');
            if ((user.boxes[boxType]||0) < qty) return reply(`❌ ${boxType} 부족 (보유: ${user.boxes[boxType]||0}개)`);

            user.boxes[boxType] -= qty;
            const results = [];
            for (let i=0; i<qty; i++) {
                const r = rollGacha(boxType, user);
                if (!r) continue;
                results.push(r);
                // 현금 아이템은 즉시 지급, 나머지는 보관함에
                if (r.item.type === 'cash') {
                    user.points += r.item.value;
                } else if (r.item.type !== 'nothing') {
                    user.gachaItems.push({name:r.item.name, type:r.item.type, value:r.item.value, grade:r.grade, desc:r.item.desc});
                }
            }
            saveData(db);

            const gradeOrder={신화:0,전설:1,영웅:2,희귀:3,일반:4,꽝:5};
            results.sort((a,b)=>gradeOrder[a.grade]-gradeOrder[b.grade]);

            let m = `📦 [${boxType} 개봉] x${qty}\n─────────────────────\n`;
            results.forEach(r => {
                m += `${GRADE_EMOJI[r.grade]||'⚪'} [${r.grade}] ${r.item.name}\n   ㄴ ${r.item.desc}\n`;
            });
            const best = results[0]?.grade;
            if (best==='신화') m+='\n🎊🎊🎊 신화 등급 획득! 🎊🎊🎊\n';
            else if (best==='전설') m+='\n✨ 전설 등급 획득!\n';
            m += `─────────────────────\n잔액: ${formatKRW(user.points)}`;
            return reply(m);
        }

        // ══════════════════════════════════════════════
        // 은행 (대출/상환)
        // ══════════════════════════════════════════════
        if (cmd === '!대출') {
            if (args.length<1) return reply('❌ !대출 [금액]');
            const amt = parseAmount(args[0]);
            if (isNaN(amt)||amt<=0) return reply('❌ 금액 오류');
            if (user.loan.amount>0) return reply(`❌ 이미 대출 중입니다. 현재 채무: ${formatKRW(calcLoanDebt(user.loan))}`);
            const nw = calcNetWorth(user);
            const maxLoan = Math.floor((nw.total + calcLoanDebt(user.loan)) * CONFIG.loan.maxRatio);
            if (amt > maxLoan) return reply(`❌ 대출 한도 초과. 최대: ${formatKRW(maxLoan)} (총자산의 ${CONFIG.loan.maxRatio*100}%)`);
            user.loan = { amount: amt, takenAt: Date.now() };
            user.points += amt;
            saveData(db);
            return reply(`🏦 [대출 성공]\n대출액: +${formatKRW(amt)}\n시간당 이자: ${CONFIG.loan.hourlyInterestRate}%\n잔액: ${formatKRW(user.points)}\n\n⚠️ 미상환 시 자산 압류될 수 있습니다.`);
        }

        if (cmd === '!상환') {
            if (user.loan.amount<=0) return reply('❌ 상환할 대출이 없습니다.');
            const debt = calcLoanDebt(user.loan);
            let amt;
            if (args[0]==='전액'||args[0]==='전액상환') amt = debt;
            else amt = parseAmount(args[0]||'');
            if (isNaN(amt)||amt<=0) return reply('❌ !상환 [금액or전액]');
            if (amt > debt) amt = debt;
            if (user.points < amt) return reply(`❌ 자금 부족. 필요: ${formatKRW(amt)} (보유: ${formatKRW(user.points)})`);
            user.points -= amt;
            const remaining = debt - amt;
            if (remaining <= 0) {
                user.loan = { amount: 0, takenAt: 0 };
                saveData(db);
                return reply(`✅ [전액 상환 완료]\n상환액: -${formatKRW(amt)}\n잔액: ${formatKRW(user.points)}`);
            } else {
                // 부분상환: 이자율 재계산을 위해 원금 재설정
                user.loan.amount = remaining;
                user.loan.takenAt = Date.now();
                saveData(db);
                return reply(`💵 [부분 상환]\n상환액: -${formatKRW(amt)}\n남은 채무: ${formatKRW(remaining)}\n잔액: ${formatKRW(user.points)}`);
            }
        }

        if (cmd === '!대출조회') {
            if (user.loan.amount<=0) return reply('✅ 현재 대출 없음');
            const debt = calcLoanDebt(user.loan);
            const hours = ((Date.now() - user.loan.takenAt) / 3600000).toFixed(1);
            return reply(
                `🏦 [대출 현황]\n─────────────────────\n` +
                `원금: ${formatKRW(user.loan.amount)}\n` +
                `경과 시간: ${hours}시간\n` +
                `시간당 이자율: ${CONFIG.loan.hourlyInterestRate}%\n` +
                `현재 채무: ${formatKRW(debt)}\n` +
                `이자: ${formatKRW(debt - user.loan.amount)}\n` +
                (user.seized ? '⛔ 압류 상태' : '')
            );
        }

        // ══════════════════════════════════════════════
        // 은행 (예금)
        // ══════════════════════════════════════════════
        if (cmd === '!예금') {
            if (args.length < 1) return reply('❌ !예금 [금액]');
            const amt = parseAmount(args[0]);
            if (isNaN(amt) || amt <= 0) return reply('❌ 금액 오류');
            if (user.points < amt) return reply(`❌ 자금 부족 (보유: ${formatKRW(user.points)})`);
            // 기존 예금이 있으면 이자를 원금에 합산 후 새 금액 추가, 예치 시각 갱신
            const accrued = calcDepositInterest(user.deposit);
            user.deposit.amount = (user.deposit.amount || 0) + accrued + amt;
            user.deposit.depositedAt = Date.now();
            user.points -= amt;
            saveData(db);
            return reply(
                `🏦 [예금 완료]\n예치액: +${formatKRW(amt)}` +
                (accrued > 0 ? ` (기존 이자 ${formatKRW(accrued)} 합산)` : '') +
                `\n총 예금: ${formatKRW(user.deposit.amount)}\n잔액: ${formatKRW(user.points)}\n\n` +
                `💡 예치 후 ${CONFIG.deposit.graceMinutes}분부터 이자가 붙기 시작합니다. (시간당 ${CONFIG.deposit.hourlyInterestRate}%)`
            );
        }

        if (cmd === '!출금') {
            if (user.deposit.amount <= 0) return reply('❌ 예금이 없습니다.');
            const accrued = calcDepositInterest(user.deposit);
            const totalAvailable = user.deposit.amount + accrued;
            let amt;
            if (args[0] === '전액') amt = totalAvailable;
            else amt = parseAmount(args[0] || '');
            if (isNaN(amt) || amt <= 0) return reply('❌ !출금 [금액or전액]');
            if (amt > totalAvailable) amt = totalAvailable;

            const remaining = totalAvailable - amt;
            user.points += amt;
            if (remaining <= 0) {
                user.deposit = { amount: 0, depositedAt: 0 };
            } else {
                user.deposit.amount = remaining;
                user.deposit.depositedAt = Date.now(); // 남은 원금 기준으로 이자 타이머 재시작
            }
            saveData(db);
            return reply(
                `🏦 [출금 완료]\n출금액: +${formatKRW(amt)}` +
                (accrued > 0 ? ` (이자 ${formatKRW(accrued)} 포함)` : '') +
                `\n남은 예금: ${formatKRW(user.deposit.amount)}\n잔액: ${formatKRW(user.points)}`
            );
        }

        if (cmd === '!예금조회') {
            if (user.deposit.amount <= 0) return reply('✅ 현재 예금 없음');
            const accrued = calcDepositInterest(user.deposit);
            const elapsedMin = ((Date.now() - user.deposit.depositedAt) / 60000);
            const graceLeft = Math.max(0, CONFIG.deposit.graceMinutes - elapsedMin);
            return reply(
                `🏦 [예금 현황]\n─────────────────────\n` +
                `원금: ${formatKRW(user.deposit.amount)}\n` +
                `경과 시간: ${(elapsedMin/60).toFixed(1)}시간\n` +
                `시간당 이자율: ${CONFIG.deposit.hourlyInterestRate}%\n` +
                (graceLeft > 0 ? `⏳ 이자 발생까지 ${graceLeft.toFixed(1)}분 남음\n` : '') +
                `누적 이자: ${formatKRW(accrued)}\n` +
                `합계(출금 시): ${formatKRW(user.deposit.amount + accrued)}`
            );
        }

        // ══════════════════════════════════════════════
        // 섯다 (새 룰: 1패-배팅-2패-배팅)
        // ══════════════════════════════════════════════
        if (cmd === '!섯다') {
            if (gameSessions[room]) return reply('⚠️ 이미 진행 중인 섯다가 있습니다.');
            if (args.length<1) return reply(`❌ !섯다 [금액] (보유: ${formatKRW(user.points)})`);
            const baseAmt = resolveBetAmount(args[0], user.points);
            if (isNaN(baseAmt)||baseAmt<=0||user.points<baseAmt) return reply(`❌ 배팅 오류 (보유: ${formatKRW(user.points)})`);

            // 광땡 보정 (신화템)
            let shuffled = [...DECK].sort(()=>Math.random()-0.5);
            const gwBonus = sumItemEffect(user, 'gwangddaeng');
            if (gwBonus>0 && Math.random() < gwBonus/100) {
                // 광땡 강제 세팅
                const combos = [[{m:3,name:'3광'},{m:8,name:'8광'}],[{m:1,name:'1광'},{m:3,name:'3광'}],[{m:1,name:'1광'},{m:8,name:'8광'}]];
                const combo = combos[Math.floor(Math.random()*combos.length)];
                shuffled[0]=combo[0]; shuffled[1]=combo[1];
            }
            const [p1,p2,d1,d2] = shuffled;

            user.points -= baseAmt;
            gameSessions[room] = {
                player: sender,
                baseBet: baseAmt,
                totalBet: baseAmt, // 지금까지 걸린 총액
                stage: 1,          // 1: 첫패 배팅단계, 2: 두번째패 배팅단계
                pCards: [p1, p2],
                dCards: [d1, d2],
                pResult: evaluateHand(p1,p2),
                dResult: evaluateHand(d1,d2),
                cardChangesLeft: sumItemEffect(user,'card_change'), // 아이템에서 온 교체권
                feeWaived: consumeItem(user,'omniscient') || consumeItem(user,'fee_waive'),
                dealerSealed: consumeItem(user,'dealer_seal')
            };
            saveData(db);

            return reply(
                `🎴 [섯다 시작]\n─────────────────────\n` +
                `👤 ${sender}\n` +
                `🃏 첫 번째 패: [ ${p1.name} ]\n` +
                `💰 기본 배팅: ${formatKRW(baseAmt)}\n` +
                `📦 잔액: ${formatKRW(user.points)}\n` +
                `─────────────────────\n` +
                `!콜 (그대로) / !다이 (포기) / !따당 (2배) / !하프 (반) / !삥 (1000원) / !올인 / [금액]\n` +
                (gameSessions[room].cardChangesLeft>0 ? `💡 !패교체 사용 가능 (${gameSessions[room].cardChangesLeft}회 남음)\n` : '')
            );
        }

        // 섯다 배팅 명령어들 (!콜, !다이, !따당, !하프, !삥, !올인, 또는 [금액])
        function handleSutdaBet(betArg) {
            const s = gameSessions[room];
            if (!s || s.player !== sender) return null;

            let addAmt;
            if (betArg === '!콜' || betArg === '콜')       addAmt = 0;
            else if (betArg === '!다이' || betArg === '다이') return { action: 'die' };
            else if (betArg === '!따당' || betArg === '따당') addAmt = s.baseBet; // 기본배팅과 같은 금액 추가
            else if (betArg === '!하프' || betArg === '하프') addAmt = Math.floor(s.baseBet/2);
            else if (betArg === '!삥' || betArg === '삥')     addAmt = 1000;
            else if (betArg === '!올인' || betArg === '올인') addAmt = user.points;
            else {
                const parsed = parseAmount(betArg);
                if (isNaN(parsed) || parsed < 0) return null;
                addAmt = parsed;
            }

            if (addAmt > user.points) return { error: `❌ 잔액 부족 (보유: ${formatKRW(user.points)})` };
            return { action: 'bet', add: addAmt };
        }

        if (['!콜','!다이','!따당','!하프','!삥','!올인'].includes(cmd) ||
            (gameSessions[room] && gameSessions[room].player === sender && !isNaN(parseAmount(cmd)))) {

            const s = gameSessions[room];
            if (!s || s.player !== sender) return; // 세션 없거나 다른 사람

            const result = handleSutdaBet(cmd);
            if (!result) return reply('❌ 배팅 명령어 오류');
            if (result.error) return reply(result.error);

            // 다이 처리
            if (result.action === 'die') {
                // 다이 시 걸린 판돈의 절반 회수 (실비형)
                const refund = Math.floor(s.totalBet * 0.5);
                user.points += refund;
                user.stats.sutda.losses = (user.stats.sutda.losses||0) + 1;
                saveData(db);
                delete gameSessions[room];
                return reply(`🏳️ [다이]\n걸린 판돈: ${formatKRW(s.totalBet)}\n환급: +${formatKRW(refund)} (50%)\n잔액: ${formatKRW(user.points)}`);
            }

            // 배팅 추가
            const addAmt = result.add;
            user.points -= addAmt;
            s.totalBet += addAmt;

            // 딜러 다이 판정 (2패 배팅단계에서 큰 금액 걸었을 때)
            let dealerDied = false;
            if (s.stage === 2 && !s.dealerSealed) {
                const betRatio = addAmt / Math.max(s.baseBet, 1);
                const dealerDieChance = Math.min(CONFIG.sutda.dealerDieMaxChance/100, betRatio * 0.03);
                if (Math.random() < dealerDieChance) dealerDied = true;
            }
            // 첫 배팅에 올인일 경우도 딜러가 극악확률로 다이
            if (s.stage === 1 && cmd === '!올인' && !s.dealerSealed) {
                if (Math.random() < 0.02) dealerDied = true;
            }

            if (dealerDied) {
                // 유저가 승리로 처리
                const winAmt = s.totalBet;
                let netWin = winAmt;
                let feeMsg = '';
                if (!s.feeWaived) {
                    const {net, fee} = applyFee(winAmt - s.baseBet, 'sutda'); // 순이익에만 수수료
                    netWin = s.baseBet + net;
                    feeMsg = `\n💸 수수료(${CONFIG.fees.sutda}%): -${formatKRW(fee)}`;
                }
                user.points += netWin * 2; // 상대 배팅도 가져옴 (딜러 대신 상대판돈으로 취급)
                user.stats.sutda.wins = (user.stats.sutda.wins||0) + 1;
                saveData(db);
                delete gameSessions[room];
                return reply(
                    `🎴 [딜러가 다이했습니다!]\n─────────────────────\n` +
                    `🏆 승리! 판돈 몰수\n` +
                    `획득: +${formatKRW(winAmt)}${feeMsg}\n` +
                    `잔액: ${formatKRW(user.points)}`
                );
            }

            // stage 1 → 2 전환
            if (s.stage === 1) {
                s.stage = 2;
                saveData(db);
                return reply(
                    `🎴 [두 번째 패 공개]\n─────────────────────\n` +
                    `🃏 내 패: [ ${s.pCards[0].name} ][ ${s.pCards[1].name} ] (${s.pResult.name})\n` +
                    `💰 현재 판돈: ${formatKRW(s.totalBet)}\n` +
                    `─────────────────────\n` +
                    `!콜 / !다이 / !따당 / !하프 / !삥 / !올인 / [금액]\n` +
                    (s.cardChangesLeft>0 ? `💡 !패교체 사용 가능 (${s.cardChangesLeft}회 남음)\n` : '')
                );
            }

            // stage 2 콜/배팅 → 결과 판정
            const pRes = s.pResult, dRes = s.dResult;
            let msg = `🎴 [섯다 결과]\n─────────────────────\n` +
                      `👤 내 패: [ ${s.pCards[0].name} ][ ${s.pCards[1].name} ] (${pRes.name})\n` +
                      `🤖 딜러: [ ${s.dCards[0].name} ][ ${s.dCards[1].name} ] (${dRes.name})\n` +
                      `💰 판돈: ${formatKRW(s.totalBet)}\n─────────────────────\n`;

            if (pRes.score > dRes.score) {
                let winAmt = s.totalBet;
                let feeMsg = '';
                if (!s.feeWaived) {
                    const {net, fee} = applyFee(winAmt - s.baseBet, 'sutda');
                    winAmt = s.baseBet + net;
                    feeMsg = `\n💸 수수료(${CONFIG.fees.sutda}%): -${formatKRW(fee)}`;
                }
                user.points += winAmt * 2;
                user.stats.sutda.wins = (user.stats.sutda.wins||0) + 1;
                msg += `🏆 승리! +${formatKRW(winAmt)}${feeMsg}`;
            } else if (pRes.score < dRes.score) {
                user.stats.sutda.losses = (user.stats.sutda.losses||0) + 1;
                msg += `💸 패배 -${formatKRW(s.totalBet)}`;
            } else {
                user.points += s.totalBet; // 무승부 환불
                user.stats.sutda.draws = (user.stats.sutda.draws||0) + 1;
                msg += `🤝 무승부. 판돈 환불`;
            }

            saveData(db);
            delete gameSessions[room];
            return reply(`${msg}\n잔액: ${formatKRW(user.points)}`);
        }

        // 섯다 패 교체 (아이템 필요)
        if (cmd === '!패교체') {
            const s = gameSessions[room];
            if (!s || s.player !== sender) return;
            if (s.cardChangesLeft <= 0) return reply('❌ 패교체권이 없습니다. (랜덤상자에서 획득)');
            const shuffled = [...DECK].sort(()=>Math.random()-0.5);
            s.pCards[0] = shuffled[0];
            s.pResult = evaluateHand(s.pCards[0], s.pCards[1]);
            s.cardChangesLeft--;
            // 실제 아이템도 하나 소모
            consumeItem(user, 'card_change');
            saveData(db);
            return reply(`🔄 [패교체] 새 패: [ ${s.pCards[0].name} ]\n남은 교체권: ${s.cardChangesLeft}회`);
        }

        // ══════════════════════════════════════════════
        // 블랙잭
        // ══════════════════════════════════════════════
        if (cmd === '!블랙잭') {
            if (blackjackSessions[room]) return reply('⚠️ 이미 진행 중');
            if (args.length<1) return reply(`❌ !블랙잭 [금액] (보유: ${formatKRW(user.points)})`);
            const bet = resolveBetAmount(args[0], user.points);
            if (isNaN(bet)||bet<=0||user.points<bet) return reply(`❌ 배팅 오류 (보유: ${formatKRW(user.points)})`);

            const pHand = [drawCard(), drawCard()];
            const dHand = [drawCard(), drawCard()];

            // 신의 손 효과: 블랙잭 확률 상승
            const divine = sumItemEffect(user, 'bj_divine');
            if (divine>0 && Math.random()<divine/100 && !isBJ(pHand)) {
                pHand[0] = { rank:'A', suit:'♠' };
                pHand[1] = { rank:'K', suit:'♥' };
            }

            user.points -= bet;
            saveData(db);
            blackjackSessions[room] = {
                player: sender,
                bet,
                hands: [{cards: pHand, doubled: false, done: false}],
                activeIdx: 0,
                dealerHand: dHand,
                canFirst: true,
                feeWaived: consumeItem(user,'omniscient') || consumeItem(user,'fee_waive'),
                insurance: hasItem(user,'bj_insurance')
            };

            const canSplit = pHand[0].rank === pHand[1].rank;
            const peek = consumeItem(user, 'bj_peek');

            let m = `🃏 [블랙잭] 배팅 ${formatKRW(bet)}\n` +
                    `👤 내 패: ${handStr(pHand)} (${calcBJ(pHand)})\n`;
            if (peek) m += `🔍 딜러 숨긴 패: ${cardStr(dHand[1])} (투시경 효과!)\n`;
            else m += `🤖 딜러: ${cardStr(dHand[0])} 🂠\n`;

            if (isBJ(pHand)) {
                const j = judgeBJ(pHand, dHand, bet, false);
                user.points += bet + j.payout;
                if (j.type==='BLACKJACK'||j.type==='WIN') user.stats.blackjack.wins=(user.stats.blackjack.wins||0)+1;
                saveData(db);
                delete blackjackSessions[room];
                return reply(m + `\n🤖 딜러: ${handStr(dHand)} (${calcBJ(dHand)})\n${bjLabel(j.type)} ${j.payout>=0?'+':''}${formatKRW(j.payout)}\n잔액: ${formatKRW(user.points)}`);
            }

            m += `\n!히트 / !스탠드`;
            if (bet <= user.points) m += ` / !더블다운`;
            if (canSplit) m += ` / !스플릿`;
            return reply(m);
        }

        if (cmd === '!히트') {
            const s = blackjackSessions[room];
            if (!s || s.player !== sender) return;
            const h = s.hands[s.activeIdx];
            if (!h || h.done) return reply('❌ 종료된 패');
            h.cards.push(drawCard());
            s.canFirst = false;
            const sc = calcBJ(h.cards);
            let m = `🃏 [히트] ${handStr(h.cards)} (${sc})\n`;
            if (sc >= 21) {
                h.done = true;
                m += sc>21 ? '💥 버스트!\n' : '✨ 21!\n';
                return reply(m + advanceBJ(db, room, sender));
            }
            m += '!히트 / !스탠드';
            return reply(m);
        }

        if (cmd === '!스탠드') {
            const s = blackjackSessions[room];
            if (!s || s.player !== sender) return;
            const h = s.hands[s.activeIdx];
            if (!h || h.done) return reply('❌ 종료된 패');
            h.done = true;
            return reply(`🛑 [스탠드] ${handStr(h.cards)} (${calcBJ(h.cards)})\n` + advanceBJ(db, room, sender));
        }

        if (cmd === '!더블다운') {
            const s = blackjackSessions[room];
            if (!s || s.player !== sender) return;
            if (!s.canFirst) return reply('❌ 더블다운은 첫 행동에서만');
            const h = s.hands[s.activeIdx];
            if (user.points < s.bet) return reply(`❌ 자금 부족`);
            user.points -= s.bet;
            h.doubled = true;
            h.cards.push(drawCard());
            h.done = true;
            saveData(db);
            const sc = calcBJ(h.cards);
            return reply(`💰 [더블다운] ${handStr(h.cards)} (${sc})${sc>21?' 💥 버스트':''}\n` + advanceBJ(db, room, sender));
        }

        if (cmd === '!스플릿') {
            const s = blackjackSessions[room];
            if (!s || s.player !== sender) return;
            if (!s.canFirst || s.hands.length>1) return reply('❌ 스플릿 불가');
            const h = s.hands[0];
            if (h.cards[0].rank !== h.cards[1].rank) return reply('❌ 같은 숫자만 스플릿 가능');
            if (user.points < s.bet) return reply(`❌ 자금 부족`);
            user.points -= s.bet;
            saveData(db);
            const c1=h.cards[0], c2=h.cards[1];
            s.hands = [
                {cards:[c1, drawCard()], doubled:false, done:false},
                {cards:[c2, drawCard()], doubled:false, done:false}
            ];
            s.activeIdx = 0;
            s.canFirst = true;
            const h1 = s.hands[0];
            return reply(`✂️ [스플릿]\n[1번째] ${handStr(h1.cards)} (${calcBJ(h1.cards)})\n!히트 / !스탠드 / !더블다운`);
        }

        // ══════════════════════════════════════════════
        // 바카라
        // ══════════════════════════════════════════════
        // 바카라 룰: 플레이어/뱅커/타이 중 하나 배팅, 카드 각각 2장씩 뽑아 합 뒷자리로 비교
        if (cmd === '!바카라') {
            if (args.length<2) return reply(`❌ !바카라 [플레이어/뱅커/타이] [금액]\n예: !바카라 뱅커 1만`);
            const choice = args[0];
            if (!['플레이어','뱅커','타이','p','b','t','P','B','T'].includes(choice))
                return reply('❌ 플레이어/뱅커/타이 중 선택');
            const bet = resolveBetAmount(args[1], user.points);
            if (isNaN(bet)||bet<=0||user.points<bet) return reply(`❌ 배팅 오류 (보유: ${formatKRW(user.points)})`);

            const normChoice = ['p','P','플레이어'].includes(choice) ? '플레이어'
                             : ['b','B','뱅커'].includes(choice) ? '뱅커' : '타이';

            user.points -= bet;

            const pCards = [drawCard(), drawCard()];
            const bCards = [drawCard(), drawCard()];
            const pScore = (calcBJ(pCards) % 10) || (calcBJ(pCards)===0 ? 0 : calcBJ(pCards)%10);
            const bScore = (calcBJ(bCards) % 10);

            // 결과 판정
            let winner;
            if (pScore > bScore) winner = '플레이어';
            else if (bScore > pScore) winner = '뱅커';
            else winner = '타이';

            const won = winner === normChoice;
            let payout = 0;
            if (won) {
                if (normChoice === '플레이어') payout = bet; // 1:1
                else if (normChoice === '뱅커') payout = Math.floor(bet * 0.95); // 1:0.95 (5% 하우스컷)
                else payout = bet * 8; // 타이 1:8
            } else {
                if (winner === '타이' && normChoice !== '타이') payout = 0; // 타이 나오면 플레이어/뱅커 배팅은 밀림(잃지 않음)
                else payout = -bet;
            }

            // 아이템 효과
            const bacBoost = sumItemEffect(user, 'baccarat_boost');
            if (won && bacBoost>0) payout = Math.floor(payout * (1 + bacBoost/100));

            // 수수료
            const feeWaived = consumeItem(user,'omniscient') || consumeItem(user,'fee_waive');
            let feeMsg = '';
            if (won && payout>0 && !feeWaived) {
                const {net, fee} = applyFee(payout, 'baccarat');
                payout = net;
                feeMsg = `\n💸 수수료(${CONFIG.fees.baccarat}%): -${formatKRW(fee)}`;
            }

            // 타이 밀림 처리
            if (payout === 0 && !won) {
                user.points += bet; // 배팅 원금 환급
            } else {
                user.points += bet + payout; // 배팅+손익
            }

            // 통계
            if (won) user.stats.baccarat.wins = (user.stats.baccarat.wins||0) + 1;
            else if (payout < 0) user.stats.baccarat.losses = (user.stats.baccarat.losses||0) + 1;

            saveData(db);
            return reply(
                `🎴 [바카라 결과]\n─────────────────────\n` +
                `👤 플레이어: ${handStr(pCards)} = ${pScore}\n` +
                `🏛️ 뱅커: ${handStr(bCards)} = ${bScore}\n` +
                `─────────────────────\n` +
                `승자: ${winner}\n` +
                `내 선택: ${normChoice}\n` +
                (won ? `🏆 적중! +${formatKRW(payout)}${feeMsg}` : payout===0 ? `🤝 밀림 (배팅액 환급)` : `💸 실패 -${formatKRW(bet)}`) + `\n` +
                `잔액: ${formatKRW(user.points)}`
            );
        }

        // ══════════════════════════════════════════════
        // 숫자맞추기
        // ══════════════════════════════════════════════
        if (cmd === '!숫자맞추기') {
            if (numberGuessSessions[room]) return reply('⚠️ 이미 진행 중');
            if (args.length<1) return reply('❌ !숫자맞추기 [개수(3~8)]');
            const n = parseInt(args[0], 10);
            if (isNaN(n)||n<3||n>8) return reply('❌ 개수는 3~8');
            const mult = Math.round(n * 0.65 * 100) / 100;
            numberGuessSessions[room] = { range: n, multiplier: mult, host: sender };
            return reply(`🔢 [숫자맞추기 개설]\n범위: 1~${n} / 배율: ${mult}배\n!숫자배팅 [금액] [숫자]`);
        }

        if (cmd === '!숫자배팅') {
            const s = numberGuessSessions[room];
            if (!s) return reply('❌ 진행 중인 게임 없음');
            if (args.length<2) return reply('❌ !숫자배팅 [금액] [숫자]');
            const bet = resolveBetAmount(args[0], user.points);
            const guess = parseInt(args[1], 10);
            if (isNaN(bet)||bet<=0||user.points<bet) return reply(`❌ 배팅 오류 (보유: ${formatKRW(user.points)})`);
            if (isNaN(guess)||guess<1||guess>s.range) return reply(`❌ 1~${s.range} 사이 숫자`);

            // 오답 제거 힌트 (아이템)
            let hintMsg = '';
            const hintPower = sumItemEffect(user, 'numguess_hint');
            if (hintPower > 0) {
                // 오답 중 hintPower개 미리 알려줌 (정답은 절대 안 나옴)
                const wrong = [];
                for (let i=1; i<=s.range; i++) if (i !== guess) wrong.push(i);
                // 진짜 정답을 미리 뽑아둬서 그건 힌트에 안 넣음
                const answerPreview = Math.floor(Math.random()*s.range)+1;
                const wrongToShow = wrong.filter(w => w !== answerPreview).slice(0, hintPower);
                if (wrongToShow.length > 0) {
                    hintMsg = `\n💡 오답 힌트: [${wrongToShow.join(', ')}] 은 정답이 아닙니다.`;
                }
                // 아이템 하나만 소모
                consumeItem(user, 'numguess_hint');
                // 아까 뽑은 정답을 재사용
                s._presetAnswer = answerPreview;
            }

            const answer = s._presetAnswer || (Math.floor(Math.random()*s.range)+1);
            const won = guess === answer;

            let msg = `🔢 [결과]\n범위 1~${s.range}\n선택: ${guess} / 정답: ${answer}${hintMsg}\n`;

            if (won) {
                let payout = Math.floor(bet * s.multiplier);
                const feeWaived = consumeItem(user,'omniscient') || consumeItem(user,'fee_waive');
                let feeMsg = '';
                if (!feeWaived) {
                    const {net, fee} = applyFee(payout - bet, 'numberGuess');
                    payout = bet + net;
                    feeMsg = `\n💸 수수료(${CONFIG.fees.numberGuess}%): -${formatKRW(fee)}`;
                }
                user.points += payout - bet;
                user.stats.numberGuess.wins = (user.stats.numberGuess.wins||0) + 1;
                msg += `🏆 정답! +${formatKRW(payout)}${feeMsg}`;
            } else {
                user.points -= bet;
                user.stats.numberGuess.losses = (user.stats.numberGuess.losses||0) + 1;
                msg += `💸 오답 -${formatKRW(bet)}`;
            }

            saveData(db);
            delete numberGuessSessions[room];
            return reply(`${msg}\n잔액: ${formatKRW(user.points)}`);
        }

        // ══════════════════════════════════════════════
        // 1:1 주사위 대결
        // ══════════════════════════════════════════════
        if (cmd === '!대결신청') {
            if (args.length<2) return reply('❌ !대결신청 [상대닉네임] [금액]');
            const target = args[0];
            const bet = resolveBetAmount(args[1], user.points);
            if (isNaN(bet)||bet<=0||user.points<bet) return reply(`❌ 배팅 오류 (보유: ${formatKRW(user.points)})`);
            if (target === sender) return reply('❌ 자기 자신에게 대결 신청 불가');
            if (!userExists(db, target)) return reply(`❌ "${target}" 유저 없음`);
            // 기존 신청 중복 방지 (신청자 기준 키)
            const myKey = `duel:challenger:${sender}`;
            const theirKey = `duel:target:${target}`;
            if (duelSessions[myKey]) return reply('⚠️ 이미 대결을 신청했습니다. 상대방의 수락을 기다려주세요.');
            if (duelSessions[theirKey]) return reply('⚠️ 해당 상대에게 이미 대결 신청이 들어와 있습니다.');

            const targetUser = ensureUser(db, target);
            if (targetUser.points < bet) return reply(`❌ 상대방 자금 부족`);

            const session = { challenger: sender, target, bet, createdAt: Date.now() };
            duelSessions[myKey] = session;
            duelSessions[theirKey] = session; // 두 키 모두 같은 객체 참조
            return reply(`🎲 [1:1 대결 신청]\n${sender} → ${target}\n배팅: ${formatKRW(bet)} (양측 동일)\n\n${target}님, !대결수락 또는 !대결거절`);
        }

        if (cmd === '!대결수락') {
            // 본인이 target인 세션 탐색
            const myKey = `duel:target:${sender}`;
            const d = duelSessions[myKey];
            if (!d) return reply('❌ 대기 중인 대결 없음. 상대방이 !대결신청 을 먼저 해야 합니다.');
            if (d.target !== sender) return reply('❌ 본인 앞으로 온 대결이 아닙니다');
            const challenger = ensureUser(db, d.challenger);
            if (challenger.points < d.bet || user.points < d.bet)
                return reply(`❌ 양측 중 자금 부족한 사람이 있습니다`);

            challenger.points -= d.bet;
            user.points -= d.bet;

            // 주사위 굴리기 (각 2개씩 합 비교)
            const rollDice = () => Math.floor(Math.random()*6)+1;
            const challengerDice = [rollDice(), rollDice()];
            const targetDice = [rollDice(), rollDice()];

            // 아이템 효과: 주사위 조작기 (유리한 방향으로 재굴림)
            const cBoost = sumItemEffect(challenger, 'dice_boost');
            const tBoost = sumItemEffect(user, 'dice_boost');
            const cSum = challengerDice[0]+challengerDice[1];
            const tSum = targetDice[0]+targetDice[1];

            let finalCSum = cSum, finalTSum = tSum;
            if (cBoost>0 && Math.random()<cBoost/100 && cSum < 10) {
                challengerDice[0] = 6; challengerDice[1] = Math.floor(Math.random()*6)+1;
                finalCSum = challengerDice[0]+challengerDice[1];
            }
            if (tBoost>0 && Math.random()<tBoost/100 && tSum < 10) {
                targetDice[0] = 6; targetDice[1] = Math.floor(Math.random()*6)+1;
                finalTSum = targetDice[0]+targetDice[1];
            }

            let winner, loser;
            if (finalCSum > finalTSum) { winner = d.challenger; loser = d.target; }
            else if (finalTSum > finalCSum) { winner = d.target; loser = d.challenger; }
            else winner = null;

            let msg = `🎲 [1:1 주사위 대결 결과]\n─────────────────────\n` +
                      `${d.challenger}: 🎲 ${challengerDice.join(' + ')} = ${finalCSum}\n` +
                      `${d.target}: 🎲 ${targetDice.join(' + ')} = ${finalTSum}\n` +
                      `─────────────────────\n`;

            if (winner) {
                const winUser = winner === sender ? user : challenger;
                let winAmt = d.bet * 2;
                const {net, fee} = applyFee(winAmt - d.bet, 'duel');
                winAmt = d.bet + net;
                winUser.points += winAmt;
                if (winner === d.challenger) {
                    challenger.stats.duel.wins = (challenger.stats.duel.wins||0)+1;
                    user.stats.duel.losses = (user.stats.duel.losses||0)+1;
                } else {
                    user.stats.duel.wins = (user.stats.duel.wins||0)+1;
                    challenger.stats.duel.losses = (challenger.stats.duel.losses||0)+1;
                }
                msg += `🏆 승자: ${winner}\n획득: +${formatKRW(winAmt)}\n💸 수수료(${CONFIG.fees.duel}%): -${formatKRW(fee)}`;
            } else {
                challenger.points += d.bet;
                user.points += d.bet;
                msg += `🤝 무승부. 배팅액 환급`;
            }

            saveData(db);
            delete duelSessions[`duel:challenger:${d.challenger}`];
            delete duelSessions[`duel:target:${d.target}`];
            return reply(msg);
        }

        if (cmd === '!대결거절') {
            const myKey = `duel:target:${sender}`;
            const d = duelSessions[myKey];
            if (!d) return reply('❌ 대기 중인 대결 없음');
            if (d.target !== sender) return reply('❌ 본인 대결이 아닙니다');
            delete duelSessions[`duel:challenger:${d.challenger}`];
            delete duelSessions[`duel:target:${d.target}`];
            return reply(`🚫 ${sender}님이 대결을 거절했습니다.`);
        }

        // ══════════════════════════════════════════════
        // 퀴즈 정답 감지 (일반 채팅에서)
        // ══════════════════════════════════════════════
        if (currentQuiz && content.includes(currentQuiz.a)) {
            if (quizTimer) { clearTimeout(quizTimer); quizTimer = null; }
            currentQuiz = null;
            const reward = rollQuizReward();
            let msg = `🎊 정답! ${sender}님 획득: `;
            if (reward.type === 'cash') {
                user.points += reward.value;
                msg += `현금 ${formatKRW(reward.value)}`;
            } else if (reward.type === 'box') {
                user.boxes[reward.value] = (user.boxes[reward.value]||0) + 1;
                msg += `${reward.value} 1개!`;
            }
            saveData(db);
            return reply(`${msg}\n잔액: ${formatKRW(user.points)}`);
        }

    } catch (e) {
        console.error('엔진 에러:', e);
    }
});

server.bind(PORT);

// 레이드 1분 타임아웃 자동 청소 (10초마다)
setInterval(() => {
    const now = Date.now();
    for (const [key, s] of Object.entries(raidSessions)) {
        if (now - (s.lastActionAt || s.startedAt || 0) > 60000) {
            console.log(`[레이드 타임아웃] ${s.sender} vs ${s.boss.name}`);
            delete raidSessions[key];
        }
    }
}, 10000);
