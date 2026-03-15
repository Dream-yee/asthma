from bs4 import BeautifulSoup
import json
import re
from typing import Dict, Any, Tuple

# 假定 HTML 檔案路徑
HTML_FILE = 'input_table.html'
# 輸出 JSON 檔案路徑
OUTPUT_JSON_FILE = 'extracted_dept_info.json'

# 科目名稱簡寫對應 (與先前保持一致)
SUBJECT_ABBR_MAP = {
    "數學甲": "數甲", "數學乙": "數乙", "數學A": "數A", "數學B": "數B",
    "國文": "國文", "英文": "英文", "物理": "物理", 
    "化學": "化學", "生物": "生物", "歷史": "歷史", 
    "地理": "地理", "公民與社會": "公民", "英聽": "英聽"
}

# --- 輔助解析函數 ---

def full_to_half_width(text: str) -> str:
    """
    將全形字符（包括英聽分級的字母）轉換為半形。
    同時移除所有全形和半形空格，以確保鍵名統一。
    """
    if not isinstance(text, str):
        return text
    
    # 針對英聽分級的全形字母 A, B, C, F
    mapping = {
        'Ａ': 'A', 'Ｂ': 'B', 'Ｃ': 'C', 'Ｆ': 'F',
        '（': '(', '）': ')', '　': '', ' ': '' # 移除全形和半形空格
    }
    
    new_text = text
    for full, half in mapping.items():
        new_text = new_text.replace(full, half)
    
    return new_text.strip()


def clean_subject_name(name: str) -> str:
    """清理科目名稱，移除括號內的內容並轉換為簡寫。"""
    # 1. 移除括號內容 (學測/分科)
    name = re.sub(r'\s*\(.*?\)', '', name).strip()
    # 2. 移除所有空格 (全形/半形)，這部分已在 full_to_half_width 處理，這裡做最終清理
    name = name.replace('　', '').replace(' ', '').strip()
    return SUBJECT_ABBR_MAP.get(name, name)


def parse_criteria(criteria_html: str) -> Dict[str, str]:
    """
    解析學測檢定標準，基於 <li> 標籤，並處理 "或" 邏輯，
    將所有參採的科目都展開，且標準值不移除尾部的 "級"。
    """
    criteria: Dict[str, str] = {}
    
    # 1. 解析 HTML 片段以找到所有列表項 (li)
    soup = BeautifulSoup(criteria_html, 'html.parser')
    # 為了能處理 <br> 換行，我們也將其視為列表項，但主要目標仍是 <li>
    list_items = soup.find_all(['li', 'div']) 

    for item in list_items:
        # 獲取單個 <li> 的文本內容
        item_text_raw = item.get_text(strip=True)
        
        # 2. 轉換和清理：僅針對 *整個文本塊* 進行半形和空格移除，確保解析成功
        item_text_cleaned = full_to_half_width(item_text_raw)
        
        # 3. 判斷是否有 "或" 邏輯
        if '或' in item_text_cleaned:
            # 使用 '或' 分割出不同的選項
            options = [opt.strip() for opt in item_text_cleaned.split('或') if opt.strip()]
        else:
            # 單一要求，視為一個選項
            options = [item_text_cleaned]
        
        # 4. 遍歷每個選項並提取 科目(標準)
        for option_text in options:
            # 查找 "科目(標準)" 模式
            # pattern: (非括號) + 括號包住的標準
            match = re.search(r'([^()]+?)\(([^()]+?)\)', option_text)
            
            if match:
                subject_raw = match.group(1).strip()
                standard_raw = match.group(2).strip()
                
                # 清理科目名稱 (已在 clean_subject_name 中處理簡寫和冗餘信息)
                subject_name = clean_subject_name(subject_raw)
                
                if subject_name:
                    # **關鍵修正：不對 standard_raw 進行任何額外的清理或格式化**
                    # 只需要確保它經過 full_to_half_width 處理即可
                    criteria[subject_name] = standard_raw
                    
    return criteria

def parse_multiplier(multiplier_text: str) -> Dict[str, float]:
    """解析科目倍數及加權，並移除所有空格。"""
    multipliers = {}
    
    # 預先移除所有空格 (全形和半形)，使匹配更簡單
    cleaned_text = full_to_half_width(multiplier_text) 
    
    # 查找 科目 x 數字 的模式
    match = re.search(r'(.+?)x(\d+\.?\d*)', cleaned_text)
    
    if match:
        # match.group(1) 可能是 "數學甲(分科)"
        subject_raw = match.group(1).strip()
        multiplier_str = match.group(2).strip()
        
        # 清理科目名稱
        subject_name = clean_subject_name(subject_raw)
        
        try:
            multiplier = float(multiplier_str)
            if subject_name:
                multipliers[subject_name] = multiplier
        except ValueError:
            pass
            
    return multipliers


def extract_university_name(soup: BeautifulSoup) -> Tuple[str, str]:
    """從查詢條件中提取學校名稱和科系名稱 (用於錯誤追蹤)。"""
    search_div = soup.find('div', id='search')
    if not search_div:
        return "未知學校", "未知科系"
    
    # 查詢條件文本在第一個 <p class="title"> 之後的 div 中
    target_div = search_div.find('p', class_='title').find_next('div')
    
    if target_div:
        # 獲取並清理文本
        text = target_div.get_text(strip=True).replace('　', '').replace(' ', '')
        
        # 假設格式是 "學校名稱-學系名稱..."
        if '-' in text:
            parts = text.split('-', 1)
            return parts[0].strip(), parts[1].strip()
            
    return "未知學校", target_div.get_text(strip=True) if target_div else "未知科系"


def extract_table_data(html_content, uni_name, dept_name):
    """主函數：提取 HTML 表格中的科系數據。"""

    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 1. 提取學校名稱
    print(f"解析到的校系：{uni_name} - {dept_name}")
    
    # 2. 找到主表格
    table = soup.find('table')
    if not table:
        print("錯誤：未找到表格。")
        return
    # 最終輸出的數據結構
    output_data = {uni_name: {}}
    
    # 直接在 table 下查找所有 tr
    rows = table.find_all('tr')
    data_rows = rows[1:] # 跳過標題行
    
    current_dept_info: Dict[str, Any] = {}
    
    # 3. 遍歷數據行
    for i, row in enumerate(data_rows):
        
        cells = row.find_all(['td', 'th'])
        
        if len(cells) < 1:
            continue

        is_new_department = i == 0 or ('rowspan' in cells[0].attrs)
        MULTIPLIER_CELL_INDEX_START = 6
        if is_new_department:
            # --- 處理新科系 ---
            dept_cell = cells[0]
            # 科系名稱也進行清理，移除空格

            rowspan_val = int(dept_cell.get('rowspan', 1))
            criteria_cell = cells[5]
            
            # 提取並解析學測檢定標準
            criteria_html = str(criteria_cell.contents)
            parsed_criteria = parse_criteria(criteria_html)
            current_dept_info = {
                "核定人數": int(cells[2].contents[0]),
                "學測標準": parsed_criteria,
                "科目倍數": {},
                "__rowspan__": rowspan_val 
            }
            
            multiplier_cell = cells[MULTIPLIER_CELL_INDEX_START]
            
        elif current_dept_info and current_dept_info.get("__rowspan__", 0) > 0:
            # --- 處理連續的科目倍數行 ---
            multiplier_cell = cells[0]
            
        else:
             continue
        
        # --- 解析科目倍數及加權 ---
        multiplier_text = multiplier_cell.get_text(strip=True)
        
        if multiplier_text.replace('-', '').strip() != '':
            parsed_multipliers = parse_multiplier(multiplier_text)
            current_dept_info["科目倍數"].update(parsed_multipliers)

        current_dept_info["__rowspan__"] -= 1

    current_dept_info.pop("__rowspan__")


    return current_dept_info

    # 4. 寫入 JSON 檔案
    # try:
    #     with open(json_filepath, 'w', encoding='utf-8') as f:
    #         json.dump(current_dept_info, f, ensure_ascii=False, indent=4)
    #     print(f"✅ 成功提取數據並儲存到 {json_filepath}")
    # except Exception as e:
    #     print(f"寫入 JSON 檔案發生錯誤: {e}")
