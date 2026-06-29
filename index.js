'use strict';

// index.js — 타짜 카카오봇 UDP 매칭 엔진 (정리/버그픽스 버전)
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'users.json');
const MARKET_FILE = path.join(__dirname, 'market.json');

const server = dgram.createSocket('udp4');

// ───────────────────────────────────────────────
// 1. 정적 데이터
// ───────────────────────────────────────────────
const COIN_NAMES = ['성빈코인', '호근코인', '정재코인'];

const ITEM_SHOP = {
    '평경장의손': { price: 1000, type: '무기', desc: '섯다 패 교체 확률 제공 (1단계)' },
    '짝귀의귀': { price: 3000, type: '액세서리', desc: '상대 패의 족보 등급 미리 예측' },
    '고니의구라': { price: 7000, type: '기술', desc: '섯다 패 교체 확률 제공 (2단계)' },
    '아귀의눈': { price: 15000, type: '눈빛', desc: '5% 확률로 삼팔광땡 설계 가능' },
    '고광렬의입담': { price: 500, type: '타이틀', desc: '단톡방 화려한 말빨 장착' }
};

const DEFAULT_LUXURY = {
    '페라리_SF90_스트라달레': { basePrice: 60000, currentPrice: 60000, type: '하이퍼카' },
    '포르쉐_911_GT3_RS': { basePrice: 35000, currentPrice: 35000, type: '스포츠카' },
    '람보르기니_우루스_퍼포만테': { basePrice: 28000, currentPrice: 28000, type: '슈퍼SUV' },
    '롤렉스_서브마리너_데이트': { basePrice: 15000, currentPrice: 15000, type: '명품시계' },
    '오데마피게_로열오크_크로노': { basePrice: 45000, currentPrice: 45000, type: '하이퍼시계' },
    '한강뷰_신축빌라': { basePrice: 1000000, currentPrice: 1000000, type: '빌라' },
    '양평_전원주택': { basePrice: 4000000, currentPrice: 4000000, type: '전원주택' },
    '강남_타워팰리스_아파트': { basePrice: 8000000, currentPrice: 8000000, type: '아파트' }
};

const DEFAULT_COIN = {
    '성빈코인': { currentPrice: 100, lastPrice: 100, desc: '하이리스크 코인' },
    '호근코인': { currentPrice: 100, lastPrice: 100, desc: '안정 추구형 대장 코인' },
    '정재코인': { currentPrice: 100, lastPrice: 100, desc: '상장폐지 위험 잡코인' }
};

const DECK = [
    { m: 1, name: '1광' }, { m: 1, name: '1피' }, { m: 2, name: '2열' }, { m: 2, name: '2피' },
    { m: 3, name: '3광' }, { m: 3, name: '3피' }, { m: 4, name: '4열' }, { m: 4, name: '4피' },
    { m: 5, name: '5열' }, { m: 5, name: '5피' }, { m: 6, name: '6열' }, { m: 6, name: '6피' },
    { m: 7, name: '7열' }, { m: 7, name: '7피' }, { m: 8, name: '8광' }, { m: 8, name: '8열' },
    { m: 9, name: '9열' }, { m: 9, name: '9피' }, { m: 10, name: '10열' }, { m: 10, name: '10피' }
];

const NEWS_POOL = {
    '성빈코인': {
        up: ['📰 [속보] 일론 머스크, \'성빈코인\' 화성 이주지 핵심 화폐 지정!', '📰 [호재] 성빈코인 재단, 해외 상장 확정 소식에 매수 대폭발'],
        down: ['📰 [경보] 개발자 지갑에서 대량의 물량이 거래소로 이동 포착!', '📰 [속보] 정부, 불법 사행성 혐의 조사 착수 소식에 패닉']
    },
    '호근코인': {
        up: ['📰 [호재] 대기업 자산운용사, \'호근코인\' 기반 ETF 승인 완료', '📰 [뉴스] 호근코인 고래들, 물량 영구 락업 계약 체결 완료'],
        down: ['📰 [뉴스] 블록체인 트전송망 오류 발생으로 마비 악재', '📰 [경보] 대주주 세금 체납 건으로 지분 강제 청산 공시']
    },
    '정재코인': {
        up: ['📰 [찌라시] 워렌 버핏이 새벽에 정재코인을 대량 매집한 정황 포착!', '📰 [속보] 글로벌 하이퍼카 결제 시스템 도입 계약 완료'],
        down: ['📰 [🚨상폐] 상장 폐지 실질심사 대상 지정 소식에 역대급 폭락!', '📰 [악재] 정재코인 공식 커뮤니티 해킹 발생 신뢰도 추락']
    }
};

const QUIZZES = [
    { q: '세상에서 가장 가난한 왕은?', a: '최저임금' },
    { q: '차가 울면 무엇일까요?', a: '카잉' },
    { q: '오리가 얼면 무엇이 될까요?', a: '언덕' },
    { q: '영화 타짜에서 아귀가 밑장빼기 하려다 걸린 화투 패는?', a: '단풍' },
    { q: '조선시대 백성들을 위해 훈민정음을 창제하신 임금은?', a: '세종대왕' }
];

// ───────────────────────────────────────────────
// 2. 런타임 상태
// ───────────────────────────────────────────────
let LUXURY_MARKET = {};
let COIN_MARKET = {};
const gameSessions = {};
let horseRace = null;
let currentQuiz = null;
let quizTimer = null;
let activeQuizRooms = [];
let activeNewsRooms = [];

// ───────────────────────────────────────────────
// 3. 저장 / 로드 (모두 예외 처리)
// ───────────────────────────────────────────────
function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
        console.error('users.json 로드 실패 (빈 데이터로 시작):', e.message);
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
            LUXURY_MARKET = (data && data.luxury) ? data.luxury : JSON.parse(JSON.stringify(DEFAULT_LUXURY));
            COIN_MARKET = (data && data.coin) ? data.coin : JSON.parse(JSON.stringify(DEFAULT_COIN));
            return;
        }
    } catch (e) {
        console.error('market.json 로드 실패 (기본값으로 초기화):', e.message);
    }
    LUXURY_MARKET = JSON.parse(JSON.stringify(DEFAULT_LUXURY));
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

// ───────────────────────────────────────────────
// 4. 유저 레코드 정규화  ← 이번 크래시의 핵심 수정
//    어떤 형태로 저장돼 있든 항상 정상 객체를 보장한다.
// ───────────────────────────────────────────────
function createDefaultUser() {
    return {
        points: 2000,
        lastCheckIn: '',
        items: [],
        luxuries: {},
        coins: { '성빈코인': 0, '호근코인': 0, '정재코인': 0 }
    };
}

function ensureUser(db, name) {
    // hasOwnProperty 로 검사해서 constructor/toString 같은 상속 속성을 유저로 오인하지 않게 함
    let u = Object.prototype.hasOwnProperty.call(db, name) ? db[name] : null;

    if (!u || typeof u !== 'object' || Array.isArray(u)) {
        u = createDefaultUser();
    }
    if (typeof u.points !== 'number' || Number.isNaN(u.points)) u.points = 2000;
    if (typeof u.lastCheckIn !== 'string') u.lastCheckIn = '';
    if (!Array.isArray(u.items)) u.items = [];
    if (!u.luxuries || typeof u.luxuries !== 'object' || Array.isArray(u.luxuries)) u.luxuries = {};
    if (!u.coins || typeof u.coins !== 'object' || Array.isArray(u.coins)) u.coins = {};
    for (const c of COIN_NAMES) {
        if (typeof u.coins[c] !== 'number' || Number.isNaN(u.coins[c])) u.coins[c] = 0;
    }

    db[name] = u;
    return u;
}

function userExists(db, name) {
    return Object.prototype.hasOwnProperty.call(db, name)
        && db[name]
        && typeof db[name] === 'object'
        && !Array.isArray(db[name]);
}

// ───────────────────────────────────────────────
// 5. 섯다 족보 판정
// ───────────────────────────────────────────────
function evaluateHand(p1, p2) {
    const m1 = p1.m, m2 = p2.m;
    const n1 = p1.name, n2 = p2.name;

    if ((n1 === '3광' && n2 === '8광') || (n1 === '8광' && n2 === '3광')) return { score: 3000, name: '38광땡' };
    if ((n1 === '1광' && n2 === '3광') || (n1 === '3광' && n2 === '1광')) return { score: 2900, name: '13광땡' };
    if ((n1 === '1광' && n2 === '8광') || (n1 === '8광' && n2 === '1광')) return { score: 2800, name: '18광땡' };
    if (m1 === m2) return { score: 2000 + m1 * 10, name: `${m1}땡` };

    const sorted = [m1, m2].sort((a, b) => a - b);
    if (sorted[0] === 1 && sorted[1] === 2) return { score: 1900, name: '알리' };
    if (sorted[0] === 1 && sorted[1] === 4) return { score: 1800, name: '독사' };
    if (sorted[0] === 1 && sorted[1] === 9) return { score: 1700, name: '구삥' };
    if (sorted[0] === 1 && sorted[1] === 10) return { score: 1600, name: '장삥' };
    if (sorted[0] === 4 && sorted[1] === 10) return { score: 1500, name: '장사' };
    if (sorted[0] === 4 && sorted[1] === 6) return { score: 1400, name: '세륙' };

    const kkut = (m1 + m2) % 10;
    if (kkut === 9) return { score: 1009, name: '갑오(9끗)' };
    if (kkut === 0) return { score: 1000, name: '망통(0끗)' };
    return { score: 1000 + kkut, name: `${kkut}끗` };
}
// ───────────────────────────────────────────────
//  경마 (PvP 파리뮤추얼 베팅)
// ───────────────────────────────────────────────
const HORSES = [
    { no: 1, name: '아귀호' },
    { no: 2, name: '곤이호' },
    { no: 3, name: '평경장호' },
    { no: 4, name: '고광렬호' },
    { no: 5, name: '정마담호' }
];

function runHorseRace() {
    const TRACK = 24;
    const dist = HORSES.map(() => 0);
    let ticks = 0, finished = false;
    while (!finished && ticks < 300) {
        ticks++;
        for (let i = 0; i < HORSES.length; i++) {
            dist[i] += Math.floor(Math.random() * 4); // 칸당 0~3 전진
            if (dist[i] >= TRACK) finished = true;
        }
    }
    const ranked = HORSES
        .map((h, i) => ({ horse: h, d: dist[i], tie: Math.random() }))
        .sort((a, b) => (b.d - a.d) || (b.tie - a.tie));
    return { ranked, TRACK };
}

function buildRaceBoard(result) {
    const { ranked, TRACK } = result;
    const BAR = 18;
    let board = '🏁 [출발 신호! 두구두구...]\n\n';
    ranked.forEach((row, idx) => {
        const filled = Math.min(BAR, Math.round((Math.min(row.d, TRACK) / TRACK) * BAR));
        const bar = '━'.repeat(filled) + '🏇';
        board += `${row.horse.no}번 ${row.horse.name} (${idx + 1}위)\n|${bar}\n`;
    });
    board += `\n🏆 우승마: [ ${ranked[0].horse.no}번 ${ranked[0].horse.name} ] 🏆`;
    return board;
}
// ───────────────────────────────────────────────
// 6. 무작위 기습 이벤트 (뉴스 / 퀴즈)
// ───────────────────────────────────────────────
function buildNewsReport() {
    const targetCoin = COIN_NAMES[Math.floor(Math.random() * COIN_NAMES.length)];
    const isUpNext = Math.random() > 0.4;
    const pool = isUpNext ? NEWS_POOL[targetCoin].up : NEWS_POOL[targetCoin].down;
    const news = pool[Math.floor(Math.random() * pool.length)];

    // 명품 시세 변동
    for (const key in LUXURY_MARKET) {
        const change = (Math.random() * 0.40) - 0.20;
        let nPrice = Math.floor(LUXURY_MARKET[key].currentPrice * (1 + change));
        const floor = Math.floor(LUXURY_MARKET[key].basePrice * 0.4);
        if (nPrice < floor) nPrice = floor;
        LUXURY_MARKET[key].currentPrice = nPrice;
    }

    let report = `\n\n─────────────────────\n📰 [실시간 월스트리트 기습 뉴스 공시]\n${news}\n\n📊 [변동 후 코인 시세 정산 명세서]`;
    for (const key in COIN_MARKET) {
        COIN_MARKET[key].lastPrice = COIN_MARKET[key].currentPrice;
        let move = (Math.random() * 0.8) - 0.40;
        if (key === targetCoin) move = isUpNext ? (Math.random() * 0.6) + 0.1 : (Math.random() * 0.5) - 0.45;
        let nCoinPrice = Math.floor(COIN_MARKET[key].currentPrice * (1 + move));
        if (nCoinPrice < 10) nCoinPrice = 10;
        COIN_MARKET[key].currentPrice = nCoinPrice;
        const diff = COIN_MARKET[key].currentPrice - COIN_MARKET[key].lastPrice;
        report += `\n 🪙 ${key}: ${COIN_MARKET[key].currentPrice.toLocaleString()}P (${diff >= 0 ? '🔺 +' : '🔻 '}${Math.abs(diff).toLocaleString()}P)`;
    }

    saveMarket();
    return report;
}

function buildQuiz() {
    currentQuiz = QUIZZES[Math.floor(Math.random() * QUIZZES.length)];
    if (quizTimer) clearTimeout(quizTimer);
    quizTimer = setTimeout(() => { currentQuiz = null; quizTimer = null; }, 60000);
    return `\n\n─────────────────────\n🚨 [돌발 기습 깜짝 퀴즈 선언!]\n🎁 상금: 1,000P\n❓ 문제: ${currentQuiz.q}\n\n※ 정답 단어를 외쳐주세요! (제한시간 1분)`;
}

// ───────────────────────────────────────────────
// 7. 서버
// ───────────────────────────────────────────────
server.on('listening', () => {
    loadMarket();
    console.log('\n🎴 타짜 무적 매칭 엔진 가동 완료! (3000포트)\n');
});

server.on('error', (err) => {
    console.error('소켓 에러:', err.message);
});

server.on('message', (msg, rinfo) => {
    // 1) 메시지 파싱 (깨진 패킷은 조용히 무시)
    let data;
    try {
        data = JSON.parse(msg.toString('utf-8'));
    } catch (e) {
        return;
    }
    if (!data || typeof data !== 'object') return;

    const room = data.room;
    const sender = data.sender;
    const content = (data.msg == null ? '' : String(data.msg)).trim();

    // 닉네임이나 내용이 비어있으면 처리하지 않음
    if (!sender || !content) return;

    try {
        const db = loadData();
        const user = ensureUser(db, sender);

        // 응답 헬퍼 (뉴스/퀴즈 기습 이벤트 부착)
        const reply = (text) => {
            let out = String(text);
            if (activeNewsRooms.includes(room) && Math.random() < 0.15) out += buildNewsReport();
            if (activeQuizRooms.includes(room) && !currentQuiz && Math.random() < 0.10) out += buildQuiz();
            const buf = Buffer.from(out, 'utf-8');
            server.send(buf, 0, buf.length, rinfo.port, rinfo.address);
        };

        // 명령어는 '첫 단어' 기준으로 정확히 매칭 (includes 중첩 버그 제거)
        const parts = content.split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1);

        // ── 기습 이벤트 ON/OFF ─────────────────────
        if (command === '!퀴즈켜기') {
            if (!activeQuizRooms.includes(room)) activeQuizRooms.push(room);
            return reply('🚨 [기습 퀴즈 활성화 완료]');
        }
        if (command === '!퀴즈끄기') {
            activeQuizRooms = activeQuizRooms.filter(r => r !== room);
            return reply('🎴 [기습 퀴즈 비활성화 완료]');
        }
        if (command === '!뉴스켜기') {
            if (!activeNewsRooms.includes(room)) activeNewsRooms.push(room);
            return reply('📰 [경제 뉴스 활성화 완료]');
        }
        if (command === '!뉴스끄기') {
            activeNewsRooms = activeNewsRooms.filter(r => r !== room);
            return reply('🎴 [경제 뉴스 비활성화 완료]');
        }

        // ── 도움말 ────────────────────────────────
        if (command === '!도움말') {
            return reply(
                '📜 [종합 가이드 북]\n\n' +
                '🎰 [1. 기본 및 섯다]\n ➔ !출석, !지갑, !정보, !섯다, !바꾸기, !배팅 [금액]\n\n' +
                '🛒 [2. 만물 상점]\n ➔ !상점 (장비 및 하이퍼카 라인업)\n\n' +
                '📈 [3. 월스트리트 거래소]\n' +
                ' ➔ !시세 : 명품 및 코인 변동 호가 확인\n' +
                ' ➔ !구매 [모델명], !판매 [모델명]\n' +
                ' ➔ !매수 [코인명] [수량], !매도 [코인명] [수량]\n' +
                ' ➔ !송금 [닉네임] [금액] : 금융 이체\n\n' +
                '🔔 [4. 무작위 기습 제어]\n ➔ !퀴즈켜기 / !퀴즈끄기\n ➔ !뉴스켜기 / !뉴스끄기'
            );
        }

        // ── 시세판 ────────────────────────────────
        if (command === '!시세') {
            let mMsg = '📊 [실시간 금융 거래소 시세판]\n\n🏎️ [1. 사치품 호가]\n';
            for (const [name, info] of Object.entries(LUXURY_MARKET)) {
                mMsg += `➔ ${name}: ${info.currentPrice.toLocaleString()}P\n`;
            }
            mMsg += '\n📈 [2. 가상자산 코인 시세]\n';
            for (const [name, info] of Object.entries(COIN_MARKET)) {
                const diff = info.currentPrice - info.lastPrice;
                mMsg += `➔ ${name}: ${info.currentPrice.toLocaleString()}P (${diff >= 0 ? '🔺 +' : '🔻 '}${Math.abs(diff).toLocaleString()}P)\n`;
            }
            return reply(mMsg);
        }

        // ── 상점 ──────────────────────────────────
        if (command === '!상점') {
            let shopMsg = '🛒 [타짜의 만물 상점]\n\n🎯 [1. 전문 장비 매장]\n';
            for (const [name, info] of Object.entries(ITEM_SHOP)) {
                shopMsg += `➔ !구매 ${name} (${info.price.toLocaleString()}P)\n   ㄴ ${info.desc}\n`;
            }
            shopMsg += '\n🏎️ [2. 최고급 하이퍼카 매장]\n';
            for (const [name, info] of Object.entries(LUXURY_MARKET)) {
                shopMsg += `➔ !구매 ${name} (${info.currentPrice.toLocaleString()}P)\n`;
            }
            return reply(shopMsg);
        }

        // ── 출석체크 ──────────────────────────────
        if (command === '!출석') {
            const today = new Date().toISOString().split('T')[0];
            if (user.lastCheckIn === today) return reply('⚠️ 오늘 이미 출석했습니다.');
            user.points += 1000;
            user.lastCheckIn = today;
            saveData(db);
            return reply(`🎉 [출석 정착금 지급]\n💵 지급 금액: +1,000P\n💰 보유 잔액: ${user.points.toLocaleString()}P`);
        }

        // ── 지갑 / 정보 ───────────────────────────
        if (command === '!지갑' || command === '!정보') {
            const items = user.items.length > 0 ? user.items.join(', ') : '없음';
            const luxList = [];
            for (const [name, count] of Object.entries(user.luxuries)) {
                if (count > 0) luxList.push(`${name}(${count}대)`);
            }
            const luxDisplay = luxList.length > 0 ? luxList.join(', ') : '없음';
            const coinDisplay = `🪙 성빈: ${user.coins['성빈코인'].toLocaleString()}개 | 호근: ${user.coins['호근코인'].toLocaleString()}개 | 정재: ${user.coins['정재코인'].toLocaleString()}개`;
            return reply(
                `💰 [${sender}님의 종합 자산 정보창]\n` +
                `현금 잔고: ${user.points.toLocaleString()}P\n` +
                '─────────────────────\n' +
                `🛠 장비: [ ${items} ]\n` +
                `👑 명품: [ ${luxDisplay} ]\n` +
                '─────────────────────\n' +
                coinDisplay
            );
        }

        // ── 송금 ──────────────────────────────────
        if (command === '!송금') {
            if (args.length < 2) return reply('❌ !송금 닉네임 금액');
            const receiverName = args[0];
            const sendAmount = parseInt(args[1], 10);

            if (Number.isNaN(sendAmount) || sendAmount <= 0 || sender === receiverName ||
                user.points < sendAmount || !userExists(db, receiverName)) {
                return reply('❌ 송금 실패. 액수 부족 혹은 미가입 대상입니다.');
            }

            const receiver = ensureUser(db, receiverName);
            user.points -= sendAmount;
            receiver.points += sendAmount;
            saveData(db);
            return reply(`💸 [송금 완료]\n💵 이체 금액: -${sendAmount.toLocaleString()}P\n👤 대상: ${receiverName}님\n💰 내 잔액: ${user.points.toLocaleString()}P`);
        }

        // ── 아이템 / 차량 구매·판매 ───────────────
        if (command === '!구매' || command === '!판매') {
            const isBuy = command === '!구매';
            if (args.length < 1) return reply('❌ 품목명을 입력하세요.');
            const itemName = args[0];

            // (1) 전문 장비 (구매만 가능)
            if (isBuy && ITEM_SHOP[itemName]) {
                const item = ITEM_SHOP[itemName];
                if (user.items.includes(itemName)) return reply('⚠️ 중복 보유 불가.');
                if (user.points < item.price) return reply(`❌ 자금 부족. 필요 금액: ${item.price.toLocaleString()}P`);
                user.points -= item.price;
                user.items.push(itemName);
                saveData(db);
                return reply(`🎁 [장비 구입 성공]\n품목: ${itemName}\n💵 지출 금액: -${item.price.toLocaleString()}P\n💰 현재 잔액: ${user.points.toLocaleString()}P`);
            }

            // (2) 명품 / 하이퍼카 (구매·판매)
            if (LUXURY_MARKET[itemName]) {
                const marketItem = LUXURY_MARKET[itemName];
                if (isBuy) {
                    if (user.points < marketItem.currentPrice) return reply(`❌ 자금 부족. 현 시세: ${marketItem.currentPrice.toLocaleString()}P`);
                    user.points -= marketItem.currentPrice;
                    user.luxuries[itemName] = (user.luxuries[itemName] || 0) + 1;
                    saveData(db);
                    return reply(`🏎️ [FLEX 영입 성사]\n품목: [${itemName}]\n💵 지출 시세: -${marketItem.currentPrice.toLocaleString()}P\n💰 현재 잔액: ${user.points.toLocaleString()}P`);
                } else {
                    if (!user.luxuries[itemName] || user.luxuries[itemName] <= 0) return reply('❌ 보유 자산이 없습니다.');
                    const sellReturn = Math.floor(marketItem.currentPrice * 0.9);
                    user.luxuries[itemName] -= 1;
                    user.points += sellReturn;
                    saveData(db);
                    return reply(`💸 [중고 매각 완료]\n품목: ${itemName}\n💵 환급 금액: +${sellReturn.toLocaleString()}P (수수료 10% 차감)\n💰 현재 잔액: ${user.points.toLocaleString()}P`);
                }
            }

            // (3) 어디에도 없는 품목
            return reply('❌ 존재하지 않는 품목입니다. !상점 으로 목록을 확인하세요.');
        }

        // ── 코인 매수 / 매도 ──────────────────────
        if (command === '!매수' || command === '!매도') {
            const isBuy = command === '!매수';
            if (args.length < 2) return reply('❌ 양식 오류. 예: !매수 성빈코인 10');
            const coinName = args[0];
            const amount = parseInt(args[1], 10);

            if (!COIN_MARKET[coinName] || Number.isNaN(amount) || amount <= 0) return reply('❌ 데이터 기입 오류.');
            const price = COIN_MARKET[coinName].currentPrice;

            if (isBuy) {
                const totalCost = price * amount;
                if (user.points < totalCost) return reply(`❌ 예수금 부족. 필요: ${totalCost.toLocaleString()}P`);
                user.points -= totalCost;
                user.coins[coinName] = (user.coins[coinName] || 0) + amount;
                saveData(db);
                return reply(`🪙 [코인 매수 체결]\n📈 종목: ${coinName}\n📦 계약 수량: ${amount.toLocaleString()}개\n💵 체결 단가: 각 ${price.toLocaleString()}P\n💰 총 결제 금액: -${totalCost.toLocaleString()}P\n💎 내 남은 현금: ${user.points.toLocaleString()}P`);
            } else {
                if (!user.coins[coinName] || user.coins[coinName] < amount) return reply('❌ 보유 물량 부족.');
                const totalReturn = price * amount;
                user.coins[coinName] -= amount;
                user.points += totalReturn;
                saveData(db);
                return reply(`📉 [코인 청산 완료]\n📉 종목: ${coinName}\n📦 처분 수량: ${amount.toLocaleString()}개\n💵 정산 단가: 각 ${price.toLocaleString()}P\n💰 총 정산 금액: +${totalReturn.toLocaleString()}P\n💎 내 전체 현금: ${user.points.toLocaleString()}P`);
            }
        }

        // ── 섯다 판 개설 ──────────────────────────
        if (command === '!섯다') {
            if (gameSessions[room]) return reply('⚠️ 게임이 이미 진행 중입니다.');

            const shuffled = [...DECK].sort(() => Math.random() - 0.5);

            // [아귀의눈] 5% 확률 삼팔광땡 설계
            if (user.items.includes('아귀의눈') && Math.random() < 0.05) {
                shuffled[0] = { m: 3, name: '3광' };
                shuffled[1] = { m: 8, name: '8광' };
            }

            const [p1, p2, d1, d2] = shuffled;
            gameSessions[room] = {
                status: 'WAITING_BET',
                player: sender,
                pCards: [p1, p2],
                dCards: [d1, d2],
                pResult: evaluateHand(p1, p2),
                dResult: evaluateHand(d1, d2)
            };

            // [짝귀의귀] 80% 확률 딜러 족보 힌트
            let earHint = '';
            if (user.items.includes('짝귀의귀') && Math.random() < 0.8) {
                const dScore = gameSessions[room].dResult.score;
                earHint = '\n\n👂 [짝귀의 귀 발동]\n';
                if (dScore >= 2800) earHint += '➔ "\'광땡\'의 기운이야!"';
                else if (dScore >= 2000) earHint += '➔ "\'땡\'의 기운이 묵직해!"';
                else if (dScore >= 1400) earHint += '➔ "중간 족보 무리야!"';
                else if (dScore >= 1001) earHint += '➔ "1끗~9끗 사이야."';
                else earHint += '➔ "\'망통(0끗)\'의 쓰레기야!"';
            }

            const canChange = user.items.includes('고니의구라') || user.items.includes('평경장의손');
            return reply(
                `🎴 [섯다 판 개설]\n\n👤 플레이어: ${sender}\n🃏 첫 번째 패: [ ${p1.name} ]${earHint}\n\n` +
                `💵 !배팅 [금액]을 기입하세요.${canChange ? '\n💡 (!바꾸기 입력 시 첫 패 교체)' : ''}`
            );
        }

        // ── 패 바꾸기 ─────────────────────────────
        if (command === '!바꾸기') {
            const session = gameSessions[room];
            if (!session || session.player !== sender || session.status !== 'WAITING_BET') return;
            if (!user.items.includes('평경장의손') && !user.items.includes('고니의구라')) return reply('❌ 장비 부족.');

            const shuffled = [...DECK].sort(() => Math.random() - 0.5);
            session.pCards[0] = shuffled[0];
            session.pResult = evaluateHand(session.pCards[0], session.pCards[1]);
            return reply(`🎰 [패 교체] 새 패: [ ${session.pCards[0].name} ]. 배팅을 이어가세요.`);
        }

        // ── 배팅 및 정산 ──────────────────────────
        if (command === '!배팅') {
            const session = gameSessions[room];
            if (!session || session.player !== sender) return;
            if (args.length < 1) return reply('❌ !배팅 금액을 기입하세요.');
            const betAmount = parseInt(args[0], 10);
            if (Number.isNaN(betAmount) || betAmount <= 0 || user.points < betAmount) return reply('❌ 배팅 오류.');

            const pRes = session.pResult;
            const dRes = session.dResult;
            let finalMsg =
                `🎴 [섯다 결과]\n` +
                `👤 내 패: [ ${session.pCards[0].name} ][ ${session.pCards[1].name} ] (${pRes.name})\n` +
                `🤖 딜러: [ ${session.dCards[0].name} ][ ${session.dCards[1].name} ] (${dRes.name})\n` +
                '──────────────────\n';

            if (pRes.score > dRes.score) {
                user.points += betAmount;
                finalMsg += `🏆 승리! +${betAmount.toLocaleString()}P`;
            } else if (pRes.score < dRes.score) {
                user.points -= betAmount;
                finalMsg += `💸 패배... -${betAmount.toLocaleString()}P`;
            } else {
                finalMsg += '🤝 무승부 비김.';
            }

            saveData(db);
            delete gameSessions[room];
            return reply(`${finalMsg}\n💰 내 지갑: ${user.points.toLocaleString()}P`);
        }
// ── 경마: 베팅 판 개설 ─────────────────────
if (command === '!경마' || command === '!경마시작') {
    if (horseRace) return reply('⚠️ 이미 경마 베팅이 진행 중입니다. (!경마현황 / !경마출발)');
    horseRace = { host: sender, pot: 0, bets: {}, horseTotals: {} };
    let intro = `🐎 [경마 베팅장 개장!] (개장자: ${sender})\n\n📋 출전마 명단\n`;
    for (const h of HORSES) intro += `  ${h.no}번 ${h.name}\n`;
    intro += `\n💵 !경마베팅 [말번호] [금액] 으로 참가\n📊 !경마현황  🚦 !경마출발  ❌ !경마취소`;
    return reply(intro);
}

// ── 경마: 베팅 참가 (1인 1마) ─────────────
if (command === '!경마베팅') {
    if (!horseRace) return reply('❌ 진행 중인 경마 베팅이 없습니다. !경마시작');
    if (args.length < 2) return reply('❌ 양식: !경마베팅 [말번호] [금액]');
    const horseNo = parseInt(args[0], 10);
    const amount = parseInt(args[1], 10);
    if (!HORSES.some(h => h.no === horseNo)) return reply('❌ 말 번호는 1~5 입니다.');
    if (Number.isNaN(amount) || amount <= 0) return reply('❌ 베팅 금액 오류.');
    if (horseRace.bets[sender]) return reply('⚠️ 이미 베팅했습니다. (1인 1마)');
    if (user.points < amount) return reply(`❌ 잔액 부족. 보유: ${user.points.toLocaleString()}P`);

    user.points -= amount;
    horseRace.pot += amount;
    horseRace.bets[sender] = { horse: horseNo, amount };
    horseRace.horseTotals[horseNo] = (horseRace.horseTotals[horseNo] || 0) + amount;
    saveData(db);

    const horse = HORSES.find(h => h.no === horseNo);
    return reply(`✅ [베팅 접수] ${sender} → ${horseNo}번 ${horse.name}\n💵 베팅액: ${amount.toLocaleString()}P\n🍯 현재 총 판돈: ${horseRace.pot.toLocaleString()}P`);
}

// ── 경마: 현황판 (실시간 배당) ────────────
if (command === '!경마현황') {
    if (!horseRace) return reply('❌ 진행 중인 경마가 없습니다.');
    let board = `📊 [경마 베팅 현황]\n🍯 총 판돈: ${horseRace.pot.toLocaleString()}P\n\n`;
    for (const h of HORSES) {
        const total = horseRace.horseTotals[h.no] || 0;
        const odds = total > 0 ? (horseRace.pot / total).toFixed(2) : '—';
        board += `${h.no}번 ${h.name}: ${total.toLocaleString()}P (배당 x${odds})\n`;
    }
    const players = Object.keys(horseRace.bets);
    board += `\n👥 참가자(${players.length}명): ${players.length ? players.join(', ') : '없음'}`;
    return reply(board);
}

// ── 경마: 취소 (개장자만, 전원 환불) ──────
if (command === '!경마취소') {
    if (!horseRace) return reply('❌ 진행 중인 경마가 없습니다.');
    if (horseRace.host !== sender) return reply('❌ 개장자만 취소할 수 있습니다.');
    for (const [name, bet] of Object.entries(horseRace.bets)) ensureUser(db, name).points += bet.amount;
    saveData(db);
    horseRace = null;
    return reply('🛑 [경마 취소] 모든 베팅이 환불되었습니다.');
}

// ── 경마: 출발 & 정산 (최소 2명, 미당첨 50% 환급) ──
if (command === '!경마출발') {
    if (!horseRace) return reply('❌ 진행 중인 경마가 없습니다.');
    if (Object.keys(horseRace.bets).length < 2) return reply('❌ 최소 2명 이상 참가해야 출발할 수 있습니다.');

    const result = runHorseRace();
    const winnerNo = result.ranked[0].horse.no;
    const winners = Object.entries(horseRace.bets).filter(([, b]) => b.horse === winnerNo);

    let payoutMsg = '';
    if (winners.length === 0) {
        payoutMsg = '\n\n😮 아무도 우승마를 맞히지 못했습니다! (베팅액의 50%만 환급, 하우스 귀속)';
        for (const [name, bet] of Object.entries(horseRace.bets)) {
            const refund = Math.floor(bet.amount * 0.5);
            ensureUser(db, name).points += refund;
            payoutMsg += `\n💸 ${name}: +${refund.toLocaleString()}P 환급 (-${(bet.amount - refund).toLocaleString()}P 손실)`;
        }
    } else {
        const winStake = winners.reduce((sum, [, b]) => sum + b.amount, 0);
        payoutMsg = '\n\n💰 [당첨금 정산]';
        for (const [name, bet] of winners) {
            const payout = Math.floor(horseRace.pot * (bet.amount / winStake));
            ensureUser(db, name).points += payout;
            const profit = payout - bet.amount;
            payoutMsg += `\n🎉 ${name}: +${payout.toLocaleString()}P (순익 ${profit >= 0 ? '+' : ''}${profit.toLocaleString()}P)`;
        }
    }

    saveData(db);
    const potSnapshot = horseRace.pot;
    horseRace = null;
    return reply(buildRaceBoard(result) + payoutMsg + `\n\n🍯 총 판돈: ${potSnapshot.toLocaleString()}P`);
}
        // ── 기습 퀴즈 정답 검증 (명령어가 아닌 일반 채팅) ──
        if (currentQuiz && content.includes(currentQuiz.a)) {
            if (quizTimer) { clearTimeout(quizTimer); quizTimer = null; }
            currentQuiz = null;
            user.points += 1000;
            saveData(db);
            return reply(`🎊 정답입니다! ${sender}님에게 기습 상금 1,000P가 지급되었습니다!\n💰 내 지갑: ${user.points.toLocaleString()}P`);
        }

    } catch (e) {
        console.error('통합 엔진 에러:', e);
    }
});

server.bind(PORT);