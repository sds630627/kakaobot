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
    // Phase 2: 직원상자 (등급 고정, 해당 등급 파티원 지급)
    employeeBox: {
        초급직원상자: { price: 80000 },
        중급직원상자: { price: 500000 },
        고급직원상자: { price: 3000000 },
        영웅직원상자: { price: 20000000 },
        전설직원상자: { price: 150000000 },
        신화직원상자: { price: 1000000000 }
    },
    // 장비상자 개봉 시 부위별 드랍 확률(가중치)
    equipDropRate: { weapon: 20, armor: 20, shield: 20, ring: 40 },
    // 장비상점 (초급 등급만 판매)
    equipShop: { weapon: 3000, armor: 3000, shield: 5000, ring: 8000 },
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
    return { id: nextEquipId(), slotType, grade, name, atk, def, hp, enhanceLevel: 0 };
}

// 강화 적용 스탯 (레벨당 +15%)
function effectiveItemStat(item) {
    if (!item) return { atk: 0, def: 0, hp: 0 };
    const mult = 1 + (item.enhanceLevel || 0) * 0.15;
    return {
        atk: Math.round((item.atk || 0) * mult),
        def: Math.round((item.def || 0) * mult),
        hp:  Math.round((item.hp  || 0) * mult)
    };
}

// 강화 성공확률 (목표 레벨 1~10 기준, index 0 = +1강화)
const ENHANCE_SUCCESS_RATE = [95, 90, 85, 80, 75, 70, 60, 50, 40, 30];
// +7강화(index 6)부터 실패 시 파괴 확률 적용
const ENHANCE_DESTROY_START_LEVEL = 7;
const ENHANCE_DESTROY_RATE = { 7: 30, 8: 40, 9: 50, 10: 60 };

const ENHANCE_GOLD_BASE  = { 초급: 5000,  중급: 20000, 고급: 80000,  영웅: 300000, 전설: 1200000, 신화: 5000000,  태초: 20000000 };
const ENHANCE_STONE_BASE = { 초급: 5,     중급: 10,    고급: 20,     영웅: 40,     전설: 80,      신화: 150,      태초: 300 };

function calcEnhanceCost(grade, targetLevel) {
    return {
        gold: (ENHANCE_GOLD_BASE[grade] || 5000) * targetLevel,
        stones: (ENHANCE_STONE_BASE[grade] || 5) * targetLevel
    };
}

// 장비상자/직원상자 개봉
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

function rollEmployeeBox(boxType) {
    const grade = boxType.replace('직원상자', '');
    const name = Object.keys(PARTY_MEMBERS).find(n => PARTY_MEMBERS[n].grade === grade);
    return name || null;
}

// 판매가 (등급/부위 기준 골드 환산)
const SELL_PRICE_BASE = { 초급: 2000, 중급: 8000, 고급: 30000, 영웅: 100000, 전설: 400000, 신화: 1500000, 태초: 6000000 };
function calcSellPrice(item) {
    const base = SELL_PRICE_BASE[item.grade] || 1000;
    const enhanceBonus = 1 + (item.enhanceLevel || 0) * 0.2;
    return Math.floor(base * enhanceBonus);
}

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
        seized: false,
        // === RPG ===
        partyMembers: {},    // { '김판돌': { count: N, level: N } } — 10명 모으면 +1강화
        activeParty: [],     // 편성된 파티원 이름 배열 (최대 3)
        equipment: { weapon: null, armor: null, shield: null, ring1: null, ring2: null },
        equipmentInventory: [], // 보유 장비 (미장착) 목록
        skills: [],          // 학습한 스킬 목록
        huntCount: 0,        // 사냥 횟수
        huntWins: 0,         // 사냥 성공
        bossKills: {},       // { '킹슬라임': N, ... } 보스별 처치 횟수
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
    let atk = BASE_ATK + eq.atk;
    let def = BASE_DEF + eq.def;
    let hp  = BASE_HP  + eq.hp;

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
    return {
        cash: user.points,
        luxuryValue: 0, // 레거시 필드 유지 (참조 안전)
        coinValue,
        empEarning: 0,
        debt,
        total: user.points + coinValue - debt
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
                ' !장비장착 [슬롯] [번호] / !장비해제 [슬롯]\n' +
                ' !장비강화 [슬롯] — 동일 부위/등급 10개+골드+강화석 소모\n' +
                ' !장비판매 [번호]\n' +
                ' !장비상점 / !장비구매 [부위] — 초급 장비 구매\n' +
                ' !장비상자목록 / !장비상자구매 / !장비상자열기\n' +
                ' !직원상자목록 / !직원상자구매 / !직원상자열기\n\n' +
                '🏦 [은행]\n' +
                ' !대출 [금액] — 대출 (자산 50% 한도)\n' +
                ' !상환 [금액or전액] — 대출 상환\n' +
                ' !대출조회 — 현재 대출 현황\n\n' +
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
            return reply('⚠️ 직원 시스템은 RPG 개편으로 제거되었습니다.\n대신 !파티원, !파티 를 사용해주세요.');
        }

        // ══════════════════════════════════════════════
        // RPG - 파티 시스템
        // ══════════════════════════════════════════════
        if (cmd === '!파티원') {
            promoteParty(user);
            saveData(db);
            const owned = Object.entries(user.partyMembers || {}).filter(([,p]) => (p.count||0) > 0 || (p.level||0) > 0);
            if (owned.length === 0) {
                return reply('❌ 보유 파티원이 없습니다.\n!직원상자구매 로 구매 후 !직원상자열기 로 뽑아보세요.');
            }
            let msg = `👥 [${sender}님의 파티원]\n─────────────────────\n`;
            owned.sort((a,b) => (b[1].level - a[1].level) || (b[1].count - a[1].count));
            for (const [name, p] of owned) {
                const info = PARTY_MEMBERS[name];
                if (!info) continue;
                const power = calcPartyMemberPower(name, p.level);
                const active = user.activeParty.includes(name) ? ' 🟢편성중' : '';
                msg += `[${info.grade}] ${name} +${p.level}${active}\n`;
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
                const eff = effectiveItemStat(it);
                const statStr = [
                    eff.atk ? `공격+${eff.atk}` : null,
                    eff.def ? `방어+${eff.def}` : null,
                    eff.hp  ? `체력+${eff.hp}`  : null
                ].filter(Boolean).join(' ');
                msg += `${SLOT_LABEL[slot]}: ${EQUIP_GRADE_EMOJI[it.grade]||''}${it.name} +${it.enhanceLevel||0}\n   ㄴ ${statStr}\n`;
            }
            if (!hasEq) msg += '\n장착한 장비가 없습니다. !장비상점 에서 구매해보세요.\n';
            msg += `─────────────────────\n!장비인벤 — 보유 장비 목록\n!장비장착 [슬롯] [인벤번호]`;
            return reply(msg);
        }

        if (cmd === '!장비인벤') {
            const inv = user.equipmentInventory || [];
            if (inv.length === 0) return reply('❌ 보유한 미장착 장비가 없습니다.\n!장비상자열기 또는 !장비상점 을 이용해보세요.');
            let msg = `🎒 [${sender}님의 장비 인벤토리]\n─────────────────────\n`;
            inv.forEach((it, i) => {
                const eff = effectiveItemStat(it);
                const statStr = [
                    eff.atk ? `공격+${eff.atk}` : null,
                    eff.def ? `방어+${eff.def}` : null,
                    eff.hp  ? `체력+${eff.hp}`  : null
                ].filter(Boolean).join(' ');
                const slotLabel = it.slotType === 'ring' ? '💍 반지' : SLOT_LABEL[it.slotType] || it.slotType;
                msg += `[${i+1}] ${EQUIP_GRADE_EMOJI[it.grade]||''}${it.name} +${it.enhanceLevel||0} (${slotLabel})\n   ㄴ ${statStr}\n`;
            });
            msg += `─────────────────────\n!장비장착 [슬롯] [번호] / !장비판매 [번호]`;
            return reply(msg);
        }

        if (cmd === '!장비장착') {
            if (args.length < 2) return reply('❌ !장비장착 [슬롯] [인벤번호]\n(슬롯: 무기/방어구/방패/반지1/반지2)');
            const slot = SLOT_ALIASES[args[0]];
            if (!slot || slot === 'ring') return reply('❌ 슬롯은 무기/방어구/방패/반지1/반지2 중 하나여야 합니다.');
            const idx = parseInt(args[1], 10) - 1;
            const inv = user.equipmentInventory || [];
            if (isNaN(idx) || idx < 0 || idx >= inv.length) return reply('❌ 인벤번호 오류. !장비인벤 으로 확인하세요.');
            const item = inv[idx];
            const requiredType = (slot === 'ring1' || slot === 'ring2') ? 'ring' : slot;
            if (item.slotType !== requiredType) return reply(`❌ "${item.name}"은(는) ${SLOT_LABEL[slot]} 부위에 장착할 수 없습니다.`);
            inv.splice(idx, 1);
            const old = user.equipment[slot];
            if (old) inv.push(old);
            user.equipment[slot] = item;
            saveData(db);
            return reply(`✅ [장착 완료] ${SLOT_LABEL[slot]}: ${EQUIP_GRADE_EMOJI[item.grade]||''}${item.name} +${item.enhanceLevel||0}` + (old ? `\n(기존 장비는 인벤토리로 이동)` : ''));
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
            if ((item.enhanceLevel || 0) >= 10) return reply('✨ 이미 최대 강화(+10) 상태입니다.');

            const targetLevel = (item.enhanceLevel || 0) + 1;
            const matchType = item.slotType;
            const fodderIdxs = [];
            user.equipmentInventory.forEach((it, i) => {
                if (it.slotType === matchType && it.grade === item.grade) fodderIdxs.push(i);
            });
            const slotTypeLabel = matchType === 'weapon' ? '무기' : matchType === 'armor' ? '방어구' : matchType === 'shield' ? '방패' : '반지';
            if (fodderIdxs.length < 10) {
                return reply(`❌ 재료 부족: 같은 부위/등급 장비가 인벤토리에 ${fodderIdxs.length}/10개 있습니다.\n(${item.grade} ${slotTypeLabel} 10개 필요)`);
            }
            const cost = calcEnhanceCost(item.grade, targetLevel);
            if (user.points < cost.gold) return reply(`❌ 골드 부족 (필요: ${formatKRW(cost.gold)})`);
            if ((user.stones || 0) < cost.stones) return reply(`❌ 강화석 부족 (필요: ${cost.stones}개, 보유: ${user.stones || 0}개)`);

            const consumeIdxs = fodderIdxs.slice(0, 10).sort((a, b) => b - a);
            for (const i of consumeIdxs) user.equipmentInventory.splice(i, 1);
            user.points -= cost.gold;
            user.stones -= cost.stones;

            const successRate = ENHANCE_SUCCESS_RATE[targetLevel - 1] ?? 30;
            const roll = Math.random() * 100;

            let msg = `🔨 [장비강화 시도] ${SLOT_LABEL[slot]} ${item.name} +${item.enhanceLevel} → +${targetLevel}\n`;
            msg += `소모: 재료10개 / ${formatKRW(cost.gold)} / 강화석${cost.stones}개\n성공확률: ${successRate}%\n─────────────────────\n`;

            if (roll < successRate) {
                item.enhanceLevel = targetLevel;
                const eff = effectiveItemStat(item);
                const statStr = [eff.atk?`공격+${eff.atk}`:null, eff.def?`방어+${eff.def}`:null, eff.hp?`체력+${eff.hp}`:null].filter(Boolean).join(' ');
                msg += `🎉 강화 성공! +${targetLevel} 달성\n   ㄴ ${statStr}`;
            } else if (targetLevel < ENHANCE_DESTROY_START_LEVEL) {
                const before = item.enhanceLevel;
                item.enhanceLevel = Math.max(0, item.enhanceLevel - 1);
                msg += `💥 강화 실패... 레벨 ${before>0?`-1 (+${before} → +${item.enhanceLevel})`:'유지 (+0)'}`;
            } else {
                const destroyChance = ENHANCE_DESTROY_RATE[targetLevel] || 0;
                const destroyRoll = Math.random() * 100;
                if (destroyRoll < destroyChance) {
                    user.equipment[slot] = null;
                    msg += `💀 강화 실패... 장비가 파괴되었습니다!`;
                } else {
                    msg += `💥 강화 실패했지만 장비는 파괴되지 않았습니다. (레벨 유지: +${item.enhanceLevel})`;
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

        if (cmd === '!직원상자목록') {
            let m = '📦 [직원상자 목록]\n─────────────────────\n';
            for (const [type, cfg] of Object.entries(CONFIG.employeeBox)) {
                const grade = type.replace('직원상자', '');
                const name = Object.keys(PARTY_MEMBERS).find(n => PARTY_MEMBERS[n].grade === grade);
                m += `${type} — ${formatKRW(cfg.price)} (${name})\n`;
            }
            m += '\n!직원상자구매 [종류] [수량]\n!직원상자열기 [종류] [수량]';
            return reply(m);
        }

        if (cmd === '!직원상자구매') {
            if (args.length < 1) return reply('❌ !직원상자구매 [종류] [수량(기본1)]\n(!직원상자목록 참고)');
            const boxType = args[0];
            const qty = parseInt(args[1] || '1', 10);
            if (!CONFIG.employeeBox[boxType]) return reply(`❌ 존재하지 않는 상자: ${boxType}`);
            if (isNaN(qty) || qty < 1 || qty > 100) return reply('❌ 수량은 1~100');
            const cost = CONFIG.employeeBox[boxType].price * qty;
            if (user.points < cost) return reply(`❌ 자금 부족 (필요: ${formatKRW(cost)})`);
            user.points -= cost;
            user.boxes[boxType] = (user.boxes[boxType] || 0) + qty;
            saveData(db);
            return reply(`📦 [구매] ${boxType} x${qty}\n지출: -${formatKRW(cost)}\n보유: ${user.boxes[boxType]}개\n잔액: ${formatKRW(user.points)}\n\n!직원상자열기 ${boxType} ${qty} 로 개봉`);
        }

        if (cmd === '!직원상자열기') {
            if (args.length < 1) return reply('❌ !직원상자열기 [종류] [수량(기본1)]');
            const boxType = args[0];
            const qty = parseInt(args[1] || '1', 10);
            if (!CONFIG.employeeBox[boxType]) return reply(`❌ 존재하지 않는 상자: ${boxType}`);
            if (isNaN(qty) || qty < 1 || qty > 100) return reply('❌ 수량은 1~100');
            if ((user.boxes[boxType] || 0) < qty) return reply(`❌ ${boxType} 부족 (보유: ${user.boxes[boxType] || 0}개)`);

            const memberName = rollEmployeeBox(boxType);
            if (!memberName) return reply('❌ 상자 오류: 해당 등급 파티원을 찾을 수 없습니다.');

            user.boxes[boxType] -= qty;
            if (!user.partyMembers[memberName]) user.partyMembers[memberName] = { count: 0, level: 0 };
            user.partyMembers[memberName].count += qty;
            promoteParty(user);
            saveData(db);

            const p = user.partyMembers[memberName];
            return reply(`📦 [${boxType} 개봉] x${qty}\n─────────────────────\n${PARTY_MEMBERS[memberName].grade} ${memberName} x${qty} 획득!\n현재: +${p.level} / ${p.count}개 보유`);
        }

        if (cmd === '!내스탯' || cmd === '!스탯') {
            promoteParty(user);
            saveData(db);
            const stat = calcCharacterStat(user);
            let msg = `⚔️ [${sender}님의 캐릭터 스탯]\n━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `❤️ HP: ${stat.maxHp.toLocaleString()}\n`;
            msg += `🗡️ 공격력: ${stat.atk.toLocaleString()}\n`;
            msg += `🛡️ 방어력: ${stat.def.toLocaleString()}\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `💰 골드: ${formatKRW(user.points)}\n`;
            msg += `💎 강화석: ${(user.stones||0).toLocaleString()}개\n`;
            msg += `🌌 소울: ${(user.souls||0).toLocaleString()}개\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━\n`;
            const eq = user.equipment || {};
            let hasEq = false;
            for (const slot of ['weapon','armor','shield','ring1','ring2']) {
                if (eq[slot]) {
                    hasEq = true;
                    const it = eq[slot];
                    msg += `${SLOT_LABEL[slot]}: ${EQUIP_GRADE_EMOJI[it.grade]||''}${it.name} +${it.enhanceLevel||0}\n`;
                }
            }
            if (!hasEq) msg += '(장착한 장비 없음 — !장비상점 에서 구매해보세요)\n';
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
            if (duelSessions[room]) return reply('⚠️ 이미 진행 중인 대결이 있습니다.');

            const targetUser = ensureUser(db, target);
            if (targetUser.points < bet) return reply(`❌ 상대방 자금 부족`);

            duelSessions[room] = { challenger: sender, target, bet, createdAt: Date.now() };
            return reply(`🎲 [1:1 대결 신청]\n${sender} → ${target}\n배팅: ${formatKRW(bet)} (양측 동일)\n\n${target}님, !대결수락 또는 !대결거절`);
        }

        if (cmd === '!대결수락') {
            const d = duelSessions[room];
            if (!d) return reply('❌ 대기 중인 대결 없음');
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
            delete duelSessions[room];
            return reply(msg);
        }

        if (cmd === '!대결거절') {
            const d = duelSessions[room];
            if (!d) return reply('❌ 대기 중인 대결 없음');
            if (d.target !== sender) return reply('❌ 본인 대결이 아닙니다');
            delete duelSessions[room];
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
