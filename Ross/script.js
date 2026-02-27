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
                </ul>`
        suggestionList.appendChild(instructionBox);

        
        // const randomElement = GUESSING[Math.floor(Math.random() * GUESSING.length)];
        // inputSuggestion.textContent = randomElement;
    } catch (error) {
        console.error("載入資料時發生錯誤:", error);
    }
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
    
    // 開始搜尋：移除置中類別
    suggestionList.classList.remove('centered');
    instructionBox.classList.add('hide')
    // 呼叫你的 API
    const results = searchEngine.get_result(query);
    renderSuggestions(results);
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
window.selectDept = (uni, dept, data) => {
    // 檢查是否已存在
    if (selectedDepts.some(d => d.uni === uni && d.dept === dept)) return;
    
    selectedDepts.push({ uni, dept, data });
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
function renderSelected(results, append = false) {
    if (!append) {
        selectedList.innerHTML = '';
        currentIndex = 0;
        allFilteredResults = results; // 保存搜尋後的結果
    }

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
                        <span class="label">去年:</span>
                        <span class="value">${w114Str}</span> 
                        <span class="data-separator">|</span>
                        <span class="value">${score114}</span>
                    </div>
                    <div class="data-row ${isWeightChanged ? 'highlight-red' : ''}">
                        <span class="label">今年:</span>
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

// 5. 複製功能
copyBtn.addEventListener('click', () => {
    if (selectedDepts.length === 0) return;

    // 格式化文本 (依照你要求的格式)
    const grouped = selectedDepts.reduce((acc, curr) => {
        if (!acc[curr.uni]) acc[curr.uni] = [];
        acc[curr.uni].push(`${curr.dept} ${curr.data}`);
        return acc;
    }, {});

    let text = "";
    for (const uni in grouped) {
        text += `${uni}\n${grouped[uni].join('\n')}\n\n`;
    }

    navigator.clipboard.writeText(text.trim()).then(() => {
        // for future dreamyee
        // stupid safari dont allow we use navigator.clipboard in http
        // which means we cant use this in localhost 🥀 🥀
        const originalText = copyBtn.innerText;
        copyBtn.innerText = "複製成功 🈶🈶🈶";
        setTimeout(() => copyBtn.innerText = originalText, 2000);
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
