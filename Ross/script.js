// main.js
const searchInput = document.getElementById('main-search');
const suggestionList = document.getElementById('suggestion-list');
const instructionBox = document.createElement("div");
const selectedList = document.getElementById('selected-list');
const copyBtn = document.getElementById('copy-btn');


let selectedDepts = [];

let CURRENT_YEAR = 115;

let schoolData = {};
let searchEngine;

const GUESSING = [
    "物理治療 職能治療 語言治療",
    "醫學系 牙醫 獸醫",
    "四大 光電 物理 材料",
    "成大 中央 太空 地科",
    "四中 師北海 電機 資工",
    "台大 政大 東吳 中正 法律",
    "頂大 經濟 財政 財務 金融",
    "四大 物理學 化學 化工 材料",
    "頂大 外文 日語 土耳其語",
    "清大 交大 材料 化學 化工",
    "頂大 四中 中文 外文",
    "台大 陽明 成大 醫學系 牙醫系",
    "頂大 機械 光電",
    "頂大 醫學大學 藥學 物治 心理"
]

async function loadData() {
    try {
        const response = await fetch('../datas/historical_result.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        schoolData = await response.json();
        searchEngine = await import("../js_utils/search_engine.js");
        searchEngine.flattenData(schoolData)

        // stupid instruction
        instructionBox.id = "instruction-box";
        instructionBox.className = "instruction-box";
        instructionBox.innerHTML = `<ul class="info-list">
                    <p>可以輸入頂大 / 四大 / 四中 / 師北海，且有些校系可以簡寫</p>
                    <p>達標佔比是分數在 ⌈加權平均 x 科目數⌉ 以上的考生比例</p>
                    <p><a class="link" href="../">單系歷年資料</a> / <a class="link" href="../comparison">大字&科目篩選版</a> / <a class="link" href="https://github.com/Dream-yee/anus_shrink_test">GitHub</a></p>
                    <p><a class="link" href="https://www.uac.edu.tw" target="_blank">考分會</a>資料連結: <a class="link" href="https://uac2.ncku.edu.tw/cross_search/" target="_blank">校系分則</a> / <a class="link" href="https://www.uac.edu.tw/uac114_note/" target="_blank">114</a> / <a class="link" href="https://www.uac.edu.tw/uac113_note/" target="_blank">113</a> / <a href="https://www.uac.edu.tw/uac112_note/" class="link" target="_blank">112</a></p>
                    <p>你可能想知道: <span id="input-suggesion" class="link"></span></p>
                </ul>`
        suggestionList.appendChild(instructionBox);
        let inputSuggestion = document.getElementById("input-suggesion");


        inputSuggestion.addEventListener('click', e => {
            searchInput.value = inputSuggestion.textContent;
            searching(inputSuggestion.textContent);
        })

        const randomElement = GUESSING[Math.floor(Math.random() * GUESSING.length)];
        inputSuggestion.textContent = randomElement;
    } catch (error) {
        console.error("載入資料時發生錯誤:", error);
    }
}
function searching(query) {
    // 開始搜尋：移除置中類別
    suggestionList.classList.remove('centered');
    instructionBox.classList.add('hide')
    // 呼叫你的 API
    const results = searchEngine.get_result(query);
    renderSuggestions(results);
}

// 1. 監聽搜尋
searchInput.addEventListener('input', debounce((e)=>{
    const query = e.target.value.trim();
    if (query === '') {
        // 回復初始狀態：置中並顯示說明
        suggestionList.innerHTML = '';
        suggestionList.appendChild(instructionBox);
        suggestionList.classList.add('centered');
        instructionBox.classList.remove('hide')
        return;
    }
    searching(query)
}, 100));


let allFilteredResults = []; // 儲存所有符合條件的結果
let currentIndex = 0, uniNumber = 0;       // 目前加載到的進度
const BATCH_SIZE = 20;      // 每一批顯示幾個
let lastUni = '';

// 2. 渲染建議清單
function renderSuggestions(results, append = false) {
    if (!append) {
        suggestionList.innerHTML = '';
        currentIndex = 0;
        uniNumber = 0;
        allFilteredResults = results; // 保存搜尋後的結果
    }
    if(currentIndex >= allFilteredResults.length) return;

    const candidates = allFilteredResults.slice(currentIndex, currentIndex + BATCH_SIZE);

    if(document.getElementById("load-more-trigger") !== null)
        document.getElementById("load-more-trigger").remove() // 很屎的做法但算了反正 it works

    for(const x of candidates) {
        if(lastUni != x.item.uni) {
            uniNumber++;
            lastUni = x.item.uni;
        }
        suggestionList.innerHTML += `
        <div class="dept-item ${uniNumber % 2 === 0 ? 'light-grey' : 'dark-grey' }" onclick="selectDept('${x.item.uni}', '${x.item.dept}', '${x.item.data}')">
            <strong>${x.item.uni}</strong> ${x.item.dept}
        </div>
    `
        currentIndex++;
    }
    suggestionList.innerHTML += `<div id="load-more-trigger" style="height: 20px; margin-bottom: 50px;"></div>`
    observer.observe(document.getElementById('load-more-trigger'));
}

// 建立 Intersection Observer
const observer = new IntersectionObserver((entries) => {
    if (searchInput.value.length !== 0 && entries[0].isIntersecting && currentIndex < allFilteredResults.length) {
        console.log("Lazy Load: 加載下一批...");
        renderSuggestions(allFilteredResults, true); // true 代表是附加進去
    }
}, { threshold: 0.5 });

// 3. 點選加入清單
window.selectDept = (uni, dept) => {
    // 檢查是否已存在
    if (selectedDepts.some(d => d.uni === uni && d.dept === dept)) return;
    
    selectedDepts.push({ uni, dept });
    renderSelected();
};

// 4. 渲染已選清單
// 輔助函式：縮寫科目名稱並排序倍率 (由高到低)
function getSortedWeights(weightObj) {
    if (!weightObj) return "無資料";
    return Object.entries(weightObj)
        .sort((a, b) => b[1] - a[1])
        .map(([sub, val]) => `${sub.charAt(0) === "數" ? sub : sub.charAt(0) }: ${val}`) // 取首字，如「國文」->「國」
        .join(' ');
}

// 4. 渲染已選清單
function renderSelected() {
    selectedList.innerHTML = selectedDepts.map((item, index) => {
        // 抓取該校系的完整資料
        const deptData = schoolData[item.uni][item.dept];
        if (!deptData) return ''; // 防呆 (為什麼我要防自己呆啊Gemini)

        const d115 = deptData[CURRENT_YEAR + ""];
        const d114 = deptData[CURRENT_YEAR - 1 + ""] ? deptData[CURRENT_YEAR - 1 + ""][0] : null; // 114 是 Array

        // 處理 115 加權與學測標準
        const w115Str = getSortedWeights(d115.科目倍數);
        const gsatStr = Object.entries(d115.學測標準 || {})
            .map(([sub, lvl]) => `${sub.charAt(0) === "數" ? sub : sub.charAt(0)}: ${lvl.substring(0, 1)}`)
            .join(' ');

        // 處理 114 加權與分數
        const w114Str = d114 ? getSortedWeights(d114.科目倍數) : "無資料";
        const score114 = d114 ? `平均 ${d114.一般考生錄取標準} (前${d114.達標比例}%)` : "無資料";

        // 檢查倍率是否有變動
        const isWeightChanged = d114 && JSON.stringify(d115.科目倍數) !== JSON.stringify(d114.科目倍數);

        // 生成外部連結 (以大考中心與大學甄選入學委員會格式為例)
        const collegeId = d115.id ? d115.id.substring(0, 3) : '';
        const ruleUrl = `https://www.cac.edu.tw/star115/system/115_Col_Show.php?collegeid=${collegeId}&deptid=${d115.id}`;
        const scoreUrl = `https://dream-yee.github.io/asthma/?school=${item.uni}&dept=${item.dept}`; 

        return `
            <div class="dept-item selected">
                <div class="dept-header-row">
                    <div class="dept-titles">
                        <div class="uni-mini">${item.uni}</div>
                        <div class="dept-name-bold">${item.dept}</div>
                    </div>
                    <div class="delete-btn" onclick="removeDept(${index})">[X]</div>
                </div>

                <div class="dept-comparison">
                    <div class="data-row">
                        <span class="label">去年: </span>
                        <span class="value">${w114Str}</span> 
                        <span class="data-separator">|</span>
                        <span class="value">${score114}</span>
                    </div>
                    <div class="data-row ${isWeightChanged ? 'highlight-red' : ''}">
                        <span class="label">今年: </span>
                        <span class="value">${w115Str}</span>
                        <span class="data-separator">|</span>
                        <span class="">${gsatStr || '無'}</span>
                    </div>
                </div>

                <div class="dept-actions">
                    <form target="_blank" class="go-right-mf">
                        <button class="action-btn" onclick="window.open('${scoreUrl}')">[歷年分數]</button>
                    </form>
                    <form target="_blank" action="https://uac2.ncku.edu.tw/cross_search/index.php?c=search&m=detail" method="post">
                        <button name="dep_id" value=${deptData[CURRENT_YEAR + ""].id} type="submit" class="action-btn" title="考分會原始資料">
                            [校系分則]
                        </button>
                    </form>
                </div>
            </div>
        `;
    }).join('');
}

// 移除校系的功能
function removeDept(index) {
    selectedDepts.splice(index, 1);
    renderSelected();
}

let copyBtnOrigin = "點我複製"

copyBtn.addEventListener('click', () => {
    if (selectedDepts.length === 0) {
        copyBtn.innerText = "👅👅👅🫲 sIx sEvEn 🫱👅👅👅";
        setTimeout(() => copyBtn.innerText = copyBtnOrigin, 2000);
        return;
    }

    // 1. 依照大學分組 (Group by University)
    const grouped = selectedDepts.reduce((acc, curr) => {
        if (!acc[curr.uni]) acc[curr.uni] = [];
        acc[curr.uni].push(curr.dept);
        return acc;
    }, {});

    // 2. 構建純文字內容
    let text = "";

    for (const uni in grouped) {
        text += `${uni}\n`; // 大學標題

        grouped[uni].forEach(dept => {
            const data = schoolData[uni][dept];
            const d115 = data["115"];
            const d114 = data["114"] ? data["114"][0] : null;

            // 格式化倍率與標準
            const w114 = getSortedWeights(d114?.科目倍數);
            const w115 = getSortedWeights(d115.科目倍數);
            const gsat = Object.entries(d115.學測標準 || {})
                .map(([s, l]) => `${s}:${l}`).join(' ');

            const score114 = d114 ? `${d114.一般考生錄取標準} (${d114.達標比例}%)` : "無114資料";

            // 構建該系所的這一行
            // 格式：系名 114加權 114分數 (114%)
            let line = `${dept} ${w114} ${score114}`;

            // 如果 115 的加權科目或倍率有變，則加上提示
            if (JSON.stringify(d115.科目倍數) !== JSON.stringify(d114?.科目倍數)) {
                line += ` / 今年 ${w115}`;
            }

            // 如果有學測標準，加在最後面
            if (gsat) {
                line += ` [${gsat}]`;
            }

            text += `${line}\n`;
        });
        text += "\n"; // 大學之間空一行
    }

    console.log(text);
    

    navigator.clipboard.writeText(text.trim()).then(() => {
        // for future dreamyee
        // stupid safari dont allow we use navigator.clipboard in http
        // which means we cant use this in localhost 🥀 🥀
        copyBtn.innerText = "複製成功 🈶🈶🈶";
        setTimeout(() => copyBtn.innerText = copyBtnOrigin, 2000);
    });
});

// 防抖函數
function debounce(func, delay = 50) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

document.addEventListener('DOMContentLoaded', loadData);
