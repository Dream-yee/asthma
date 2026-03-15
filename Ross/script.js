// main.js
const searchInput = document.getElementById('main-search');
const suggestionList = document.getElementById('suggestion-list');
const instructionBoxLeft = document.createElement("div");
const instructionBoxRight = document.createElement("div");
const selectedList = document.getElementById('selected-list');
const scoreInputs = document.getElementsByClassName('score-input')
const copyBtn = document.getElementById('copy-btn');


let selectedDepts = [];
let selectedDeptsIndexes = {};

let CURRENT_YEAR = 115;

let schoolData = {};
let astScoreDistribution = {};
let searchEngine;

let gsatInputed = false;

let copypasta = {};

let gsatMapping = {}
const stupidAlias = {
    "創意表現": "創意",
    "美術鑑賞": "鑑賞",
    "彩繪技法": "彩繪",
    "水墨書畫": "水墨"
}

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

        // damn it
        // Idk if I should make this in every year
        // since Im lazy and who the fuck care about that
        const response1 = await fetch(`../datas/${CURRENT_YEAR - 1}/subjects_combinations.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        astScoreDistribution = await response1.json();

        // stupid instruction
        instructionBoxLeft.id = "instruction-box-left";
        instructionBoxLeft.className = "instruction-box";
        instructionBoxLeft.innerHTML = `<ul class="info-list">
                    <p>主要目的是希望你可以複製到記事本裡讓自己隨時可以拿出來幻想一下</p>
                    <p>最右方學測按鈕點開會出現學測<b>60級分制</b>分數的輸入框, <br>輸入後, 下方列表及複製的結果將改為顯示你在分科所需要的平均分數</p>
                    <p>可以輸入頂大 / 四大 / 四中 / 師北海，且有些校系可以簡寫</p>
                    <p>你可能想知道: <span id="input-suggesion" class="link"></span></p>
                </ul>`

        instructionBoxRight.id = "instruction-box-right";
        instructionBoxRight.className = "instruction-box";
        instructionBoxRight.innerHTML = `<ul class="info-list">
                    <p>你要搜尋然後點選校系這個地方才會有東西</p>
                    <p><a class="link" href="../">單系歷年資料</a> / <a class="link" href="../comparison">搜尋快速檢視</a> / <a class="link" href="https://github.com/Dream-yee/anus_shrink_test">GitHub</a></p>
                    <p><a class="link" href="https://www.uac.edu.tw" target="_blank">考分會</a>資料連結: <a class="link" href="https://uac2.ncku.edu.tw/cross_search/" target="_blank">校系分則</a> / <a class="link" href="https://www.uac.edu.tw/uac114_note/" target="_blank">114</a> / <a class="link" href="https://www.uac.edu.tw/uac113_note/" target="_blank">113</a> / <a href="https://www.uac.edu.tw/uac112_note/" class="link" target="_blank">112</a></p>
                </ul>`
        suggestionList.appendChild(instructionBoxLeft);
        selectedList.appendChild(instructionBoxRight);
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
    instructionBoxLeft.classList.add('hide')
    // 呼叫你的 API
    const results = searchEngine.get_result(query);
    renderSuggestions(results);
}

// 1. 監聽搜尋
searchInput.addEventListener('input', debounce((e) => {
    const query = e.target.value.trim();
    if (query === '') {
        // 回復初始狀態：置中並顯示說明
        suggestionList.innerHTML = '';
        suggestionList.appendChild(instructionBoxLeft);
        suggestionList.classList.add('centered');
        instructionBoxLeft.classList.remove('hide')
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
    if (currentIndex >= allFilteredResults.length) return;

    const candidates = allFilteredResults.slice(currentIndex, currentIndex + BATCH_SIZE);

    if (document.getElementById("load-more-trigger") !== null)
        document.getElementById("load-more-trigger").remove() // 很屎的做法但算了反正 it works


    for (const x of candidates) {
        if (lastUni != x.item.uni) {
            uniNumber++;
            lastUni = x.item.uni;
        }
        let deptId = schoolData[x.item.uni][x.item.dept][CURRENT_YEAR + ""].id;

        suggestionList.innerHTML += `
        <div id="dept_${deptId}" class="dept-item ${uniNumber % 2 === 0 ? 'light-grey' : 'dark-grey'} ${selectedDeptsIndexes[deptId] !== undefined ? 'suggestion_selected' : '' }" onclick="${selectedDeptsIndexes[deptId] !== undefined ? `removeDept(${selectedDeptsIndexes[deptId]}, '${deptId}')` : `selectDept('${x.item.uni}', '${x.item.dept}', '${deptId}')`}">
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
window.selectDept = (uni, dept, id) => {
    // 檢查是否已存在
    if (selectedDepts.some(d => d.uni === uni && d.dept === dept)) return;
    selectedDepts.push({ uni, dept });
    document.getElementById(`dept_${id}`).classList.add('suggestion_selected');
    renderSelected(true);
};

// 4. 渲染已選清單
// 輔助函式：縮寫科目名稱並排序倍率 (由高到低)
function getSortedWeights(weightObj, forCopy = false) {
    if (!weightObj) return "無資料";
    if (!forCopy)
        return Object.entries(weightObj)
            .sort((a, b) => {
                if (a[1] === b[1]) {
                    return a[0].localeCompare(b[0], 'zh-Hant');
                }
                else return b[1] - a[1];
            })
            .map(([sub, val]) => `${sub.charAt(0) === "數" ? sub : sub.charAt(0)}: ${val}`)
            .join(' ');
    else {
        let weight = null, result = "";
        for (const entry of Object.entries(weightObj)
            .sort((a, b) => {
                if (a[1] === b[1]) {
                    return a[0].localeCompare(b[0], 'zh-Hant');
                }
                else return b[1] - a[1];
            })
            .map(([sub, val]) => [sub.charAt(0) === "數" ? sub.charAt(1) : sub.charAt(0), val])) {
            if (weight !== entry[1]) {
                if (weight !== null) result += (weight + "");
                weight = entry[1];
            }
            result += entry[0];
        } // so fucking ugly;
        result += (weight + "")
        return result
    }
}

// 4. 渲染已選清單
function renderSelected(adding = false) {
    selectedDeptsIndexes = [];
    gsatInputed = false;

    // 定義學測科目對應 key (這要跟你的 schoolData 內的 key 匹配)

    selectedList.innerHTML = selectedDepts.map((item, index) => {
        const deptData = schoolData[item.uni][item.dept];
        if (!deptData) return '';

        const d115 = deptData[CURRENT_YEAR + ""];
        const w115Str = getSortedWeights(d115.科目倍數);
        const w115Str4Copy = getSortedWeights(d115.科目倍數, true);
        const gsatStr = Object.entries(d115.學測標準 || {})
            .map(([sub, lvl]) => `${sub === "數A" || sub === "數B" || sub === "英聽" ? sub : sub.charAt(0)}: ${lvl.substring(0, 1)}`)
            .join(' ');
        let isWeightChanged = false;
        const scoreUrl = `https://dream-yee.github.io/asthma/?school=${item.uni}&dept=${item.dept}`;

        let historyScoreText = "";
        if (copypasta[item.uni] === undefined) copypasta[item.uni] = {};
        if (deptData[CURRENT_YEAR - 1 + ""] !== undefined) {
            let pastaCache = [];
            for (const d114 of deptData[CURRENT_YEAR - 1 + ""]) {

                // stupid variable name
                // d115 is this year and d114 is the previous year
                // again, fucking stupid variable name

                const w114Str = d114 ? getSortedWeights(d114.科目倍數) : "無資料";
                const w114Str4Copy = d114 ? getSortedWeights(d114.科目倍數, true) : "無資料";
                isWeightChanged = w115Str !== w114Str || isWeightChanged;

                // --- 分科需均計算邏輯 ---
                let scoreDisplay = "無資料";

                const weights = d114.科目倍數;
                let goal = d114.一般考生錄取標準總分;

                let userGsatWeightedSum = 0;
                let subtestWeightsSum = 0;
                let astSubjects = 0;
                let weightsSum = 0;

                Object.entries(weights).forEach(([sub, weight]) => {
                    if(sub === "術科") {
                        let pe_score = 0.0;
                        if(d115["術科"] !== undefined)
                            Object.entries(d115["術科"]).forEach(([pe_sub, pe_weight]) => { // sry this actually should use the last year data but it's kinda complicated
                                pe_score += gsatMapping[stupidAlias[pe_sub] !== undefined ? stupidAlias[pe_sub] : pe_sub] * pe_weight;
                            })
                        else pe_score = gsatMapping["體育"] * 100;
                        if(pe_score > 0) {
                            pe_score /= 100;
                            goal -= pe_score * weight;
                            userGsatWeightedSum += weight;
                        }
                    } else if (gsatMapping[sub] === undefined) {
                        subtestWeightsSum += weight;
                        astSubjects++;
                    } else if (gsatMapping[sub] !== "") {
                        goal -= parseFloat(gsatMapping[sub]) * weight;
                        userGsatWeightedSum += weight;
                    }
                    weightsSum += weight;
                });

                // 如果有學測成績，且有需要考分科科目s
                const required = goal / subtestWeightsSum;
                if (userGsatWeightedSum > 0) {
                    const allTimesOne = required * astSubjects;
                    // 顯示計算結果，四捨五入到小數第二位
                    let pr_txt = d114["去學測組別代號"] !== null ? `前${astScoreDistribution[d114["去學測組別代號"]]["累積百分比"][Math.ceil(allTimesOne) + ""]}%` : "人數統計無資料"; // some statics is actually accessible if I do a little 排列組合 but Im lazy.
                    let pr_txt_pasta = d114["去學測組別代號"] !== null ? `(前${astScoreDistribution[d114["去學測組別代號"]]["累積百分比"][Math.ceil(allTimesOne) + ""]}%)` : "";
                    scoreDisplay = `你分科需均: <b style="color:var(--sage-dark)">${required.toFixed(2)} (${required > 60 ? "你就別想了" : pr_txt})</b>`;
                    pastaCache.push(`${item.dept} ${w114Str4Copy} [${required.toFixed(2)} ${pr_txt_pasta}]${d114["校系名稱"] !== item.dept ? ` (${d114["校系名稱"]})` : ""}`)
                    gsatInputed = true;
                } else {
                    // 回歸原始顯示
                    scoreDisplay = `平均 ${d114.一般考生錄取標準} (前${d114.達標比例}%)`;
                    pastaCache.push(`${item.dept} ${w114Str4Copy} [${d114.一般考生錄取標準} (前${d114.達標比例}%)] ${d114["校系名稱"] !== item.dept ? `(${d114["校系名稱"]})` : ""}`);
                }
                historyScoreText += `
                        ${deptData[CURRENT_YEAR - 1 + ""].length > 1 ? "<span class='last-year above-standards'>(" + d114.校系名稱 + ")</span>" : ""}
                        <div class="data-row">
                        <span class="label">去年: </span>
                        <span class="value">${w114Str}</span> 
                        <span class="data-separator">|</span>
                        <span class="value">${scoreDisplay}</span>
                    </div>`

                if (getSortedWeights(d115.科目倍數) !== getSortedWeights(d114?.科目倍數)) {
                    pastaCache[pastaCache.length - 1] += ` | 今年 ${w115Str4Copy}`;
                }
            }
            copypasta[item.uni][item.dept] = pastaCache.join('\n');
        }

        if(copypasta[item.uni][item.dept] === undefined) 
            copypasta[item.uni][item.dept] = `${item.dept} ${w115Str4Copy}`;

        document.getElementById(`dept_${d115.id}`)?.setAttribute('onclick', `removeDept(${index}, '${d115.id}')`)

        selectedDeptsIndexes[d115.id] = index;

        return `
            <div class="dept-item selected">
                <div class="dept-header-row">
                    <div class="dept-titles">
                        <div class="uni-mini">${item.uni}</div>
                        <div class="dept-name-bold">${item.dept} <span class="last-year">${deptData[CURRENT_YEAR - 1 + ""] !== undefined && deptData[CURRENT_YEAR - 1 + ""].length === 1 && deptData[CURRENT_YEAR - 1 + ""][0].校系名稱 !== item.dept ? "(去年: " + deptData[CURRENT_YEAR - 1 + ""][0].校系名稱 + ")" : ""}</span></div>
                    </div>
                    <div class="delete-btn" onclick="removeDept(${index}, '${d115.id}')">[X]</div>
                </div>

                <div class="dept-comparison">
                    ${historyScoreText}
                    <div class="data-row">
                        <span class="label">今年: </span>
                        <span class="${isWeightChanged ? 'highlight-red' : ''} value">${w115Str}</span>
                        <span class="data-separator">|</span>
                        <span class="value">${gsatStr || '無'}</span>
                    </div>
                </div>

                <div class="dept-actions">
                    <form target="_blank" class="go-right-mf">
                        <button type="button" class="action-btn" onclick="window.open('${scoreUrl}')">[歷年分數]</button>
                    </form>
                    <form target="_blank" action="https://uac2.ncku.edu.tw/cross_search/index.php?c=search&m=detail" method="post">
                        <input type="hidden" name="dep_id" value="${d115.id}">
                        <button type="submit" class="action-btn" title="考分會原始資料">
                            [校系分則]
                        </button>
                    </form>
                </div>
            </div>
        `;
    }).join('');


    if (selectedDepts.length === 0) {
        selectedList.appendChild(instructionBoxRight);
        selectedList.classList.add('centered');
        instructionBoxRight.classList.remove('hide');
    } else {
        selectedList.classList.remove('centered');
        instructionBoxRight.classList.add('hide')
    }

    if (adding) selectedList.scrollTo({ top: selectedList.scrollHeight, behavior: 'smooth' });
}

// 移除校系的功能
function removeDept(index, id) {
    if (document.getElementById(`dept_${id}`) !== null) {
        document.getElementById(`dept_${id}`).classList.remove("suggestion_selected");
        document.getElementById(`dept_${id}`).setAttribute('onclick', `selectDept('${selectedDepts[index].uni}', '${selectedDepts[index].dept}', '${id}')`)
        selectedDeptsIndexes[index] = undefined;
    }
    selectedDepts.splice(index, 1);
    renderSelected();
}

let copyBtnOrigin = "點我複製"

copyBtn.addEventListener('click', () => {
    if (selectedDepts.length === 0) {
        copyBtn.innerText = "👅👅👅🫲 sÎx sËvẼn 🫱👅👅👅";
        setTimeout(() => copyBtn.innerText = copyBtnOrigin, 2000);
        return;
    }

    const priorityOrder = [
        "國立臺灣大學", "國立清華大學", "國立陽明交通大學", "國立成功大學", "國立政治大學",
        "國立中央大學", "國立中山大學", "國立中興大學", "國立中正大學",
        "國立臺灣師範大學", "國立臺北大學", "國立臺灣海洋大學"
    ];

    // 1. 依照大學分組 (Group by University)
    const grouped = selectedDepts.reduce((acc, curr) => {
        if (!acc[curr.uni]) acc[curr.uni] = [];
        acc[curr.uni].push(curr.dept);
        return acc;
    }, {});

    const sortedUnis = Object.keys(grouped).sort((a, b) => {
        // 尋找在 priorityOrder 中的索引
        const indexA = priorityOrder.findIndex(p => a.includes(p));
        const indexB = priorityOrder.findIndex(p => b.includes(p));

        // 邏輯：如果在名單內，index 會是 0, 1, 2...；不在名單內會是 -1
        if (indexA !== -1 && indexB !== -1) return indexA - indexB; // 都在名單內，按順序排
        if (indexA !== -1) return -1; // 只有 A 在名單，A 優先
        if (indexB !== -1) return 1;  // 只有 B 在名單，B 優先
        return a.localeCompare(b, 'zh-Hant'); // 都不在名單，按字首筆畫排
    });

    // 2. 構建純文字內容
    let text = '';

    if (gsatInputed) {
        text = "你所複製的是以";
        for(const entry of Object.entries(gsatMapping)) {
            if(entry[1] !== "")
                text += `\n${entry[0]}: ${entry[1]}`
        }
        text += "\n為根據後，在分科所需的平均及其統計資料\n\n\n"
        
    } else {
        text = "你所複製的是最原始的錄取分數平均及統計資料\n\n\n"
    }

    for (const uni of sortedUnis) {
        text += `${uni}\n`; // 大學標題

        grouped[uni].forEach(dept => {
            text += `${copypasta[uni][dept]}\n`;
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

// 切換開關
function toggleGsatIsland() {
    document.getElementById('gsat-island').classList.toggle('active');
    let text = document.getElementById('trigger-text');
    text.textContent = text.textContent === "學測" ? "收回" : "學測"
}

// 1. 定義模式與科目 (科目名稱參考自大考中心資料 [cite: 11, 23, 36])
const MODES = [
    { name: "一般", subjects: ["國文", "英文", "數A", "數B", "自然", "社會"], key: "academic" },
    { name: "音樂", subjects: ["主修", "副修", "樂理", "視唱", "聽寫"], key: "music" },
    { name: "美術", subjects: ["素描", "創意", "彩繪", "鑑賞", "水墨"], key: "art" },
    { name: "體育", subjects: ["體育"], key: "sport" }
];

let currentModeIndex = 0;

// 2. 切換模式函數
function cycleMode() {
    currentModeIndex = (currentModeIndex + 1) % MODES.length;
    renderInputs();
    
    // 更新按鈕文字
    document.getElementById('mode-toggle-btn').innerText = `${MODES[currentModeIndex].name}`;
}

// 3. 動態渲染輸入框
function renderInputs() {
    const container = document.getElementById('score-inputs-container');
    const mode = MODES[currentModeIndex];
    
    container.innerHTML = mode.subjects.map((sub, i) => {
        const nextSub = mode.subjects[i + 1] ? `input-${mode.key}-${i + 1}` : '';
        return `
            <input type="number" 
                   class="score-input" 
                   id="input-${mode.key}-${i}" 
                   data-sub="${sub}"
                   data-next="${nextSub}"
                   data-previous="input-${mode.key}-${i - 1}"
                   placeholder="${sub}" 
                   value="${gsatMapping[sub] || ''}"
                   min="0" max="100">
        `;
    }).join('');

    // 重新綁定事件監聽
    bindInputEvents();
}

function bindInputEvents() {
    const inputs = document.querySelectorAll('.score-input');
    // 1. 自動儲存與自動跳轉
    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            const nextId = e.target.getAttribute('data-next');

            // 自動跳轉邏輯：如果輸入了兩位數，或是輸入的數字 > 6 (既然最高60)
            if ((parseInt(val) > 10 && val.length === 2 && val.length == 2 && currentModeIndex !== 0) || (val.length >= 2 && (currentModeIndex === 0 || val.length === 3)) || (currentModeIndex === 0 && parseInt(val) > 6 && val.length === 1)) {
                if (currentModeIndex === 0 && parseInt(val) > 60) {
                    e.target.value = 60;
                } else if (currentModeIndex !== 0 && parseInt(val) > 100) {
                    e.target.value = 100;
                }
                if (nextId) {
                    const nextEl = document.getElementById(nextId);
                    if (nextEl) nextEl.focus();
                }
            }
            gsatMapping[input.getAttribute('data-sub')] = e.target.value;
            renderSelected();
        })

        // 支援 Backspace 刪除後跳回前一格
        input.addEventListener('keydown', (e) => {
            const previousId = e.target.getAttribute('data-previous');
            if (e.key === 'Backspace' && e.target.value === '') {
                if (previousId) {
                    document.getElementById(previousId).focus()
                }
                gsatMapping[input.getAttribute('data-sub')] = undefined;
                renderSelected();
            }
        });
    });

}

// 5. 儲存當前模式的成績
function saveCurrentModeScores() {
    const mode = MODES[currentModeIndex];
    const inputs = document.querySelectorAll('.score-input');
    let scores = {};
    
    inputs.forEach(input => {
        scores[input.getAttribute('data-sub')] = input.value;
    });
    
}

// 頁面載入時初始化
window.addEventListener('DOMContentLoaded', () => {
    renderInputs();
});

document.addEventListener('DOMContentLoaded', loadData);