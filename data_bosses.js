{
  "_comment": "레이드 보스 — 전투력 공식: (공격x50+방어x80+HPx5)x3 기준",
  "bosses": [
    { "name": "킹 슬라임",    "grade": "초급", "recommendedPower": 3000,    "minPower": 500,    "maxHp": 500,    "atk": 12,   "def": 3,    "gold": 5000,     "stones": 5,    "souls": 1,   "enrageHp": 0.3, "enrageAtkMult": 1.8, "desc": "거대한 젤리 덩어리. 작은 슬라임들을 흡수해 힘을 키웠다." },
    { "name": "숲의 수호자",  "grade": "중급", "recommendedPower": 10000,   "minPower": 2000,   "maxHp": 1500,   "atk": 30,   "def": 10,   "gold": 20000,    "stones": 15,   "souls": 3,   "enrageHp": 0.3, "enrageAtkMult": 2.0, "desc": "고대 숲을 지키는 정령. 분노하면 자연의 힘을 해방한다." },
    { "name": "철갑 골렘",    "grade": "고급", "recommendedPower": 40000,   "minPower": 8000,   "maxHp": 5000,   "atk": 70,   "def": 30,   "gold": 80000,    "stones": 40,   "souls": 8,   "enrageHp": 0.25,"enrageAtkMult": 2.2, "desc": "폐광에서 발굴된 고대 전쟁 병기. 분노 시 핵심 코어가 폭발한다." },
    { "name": "빙하 용",      "grade": "영웅", "recommendedPower": 150000,  "minPower": 25000,  "maxHp": 15000,  "atk": 180,  "def": 70,   "gold": 300000,   "stones": 100,  "souls": 20,  "enrageHp": 0.25,"enrageAtkMult": 2.5, "desc": "얼음 동굴의 지배자. 광폭화하면 절대영도 브레스를 쏟아낸다." },
    { "name": "용암 군주",    "grade": "전설", "recommendedPower": 400000,  "minPower": 80000,  "maxHp": 50000,  "atk": 500,  "def": 150,  "gold": 1000000,  "stones": 250,  "souls": 50,  "enrageHp": 0.3, "enrageAtkMult": 2.5, "desc": "용의 둥지 깊숙이 군림하는 불의 지배자." },
    { "name": "천공의 군주",  "grade": "신화", "recommendedPower": 800000,  "minPower": 200000, "maxHp": 200000, "atk": 1500, "def": 400,  "gold": 5000000,  "stones": 600,  "souls": 120, "enrageHp": 0.3, "enrageAtkMult": 3.0, "desc": "하늘 위 섬에서 세계를 내려다보는 존재." },
    { "name": "혼돈의 지배자","grade": "태초", "recommendedPower": 1500000, "minPower": 400000, "maxHp": 1000000,"atk": 5000, "def": 1000, "gold": 30000000, "stones": 2000, "souls": 500, "enrageHp": 0.3, "enrageAtkMult": 3.5, "desc": "모든 것의 근원이자 끝. 세계의 질서를 파괴하려 한다." }
  ],
  "patterns": [
    { "id": "crush",  "announce": "💥 보스가 강력한 분쇄 공격을 준비합니다!", "counter": "방어", "wrongPenalty": 1.5, "counterBonus": 0.5, "counterAttackMult": 1.0 },
    { "id": "weak",   "announce": "🎯 보스가 방어를 낮추고 약점을 노출합니다!", "counter": "강공", "wrongPenalty": 1.0, "counterBonus": 1.0, "counterAttackMult": 2.2 },
    { "id": "heal",   "announce": "💉 보스에게서 회복의 기운이 느껴집니다!",   "counter": "방해", "wrongPenalty": 0,   "counterBonus": 1.0, "counterAttackMult": 1.5, "special": "blockHeal" },
    { "id": "charge", "announce": "⚡ 보스가 땅을 박차며 빠르게 돌진합니다!",  "counter": "회피", "wrongPenalty": 2.0, "counterBonus": 0.0, "counterAttackMult": 1.3 }
  ]
}
