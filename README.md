# PVQC 電機電子專業英文測驗挑戰系統 (793 題庫)

一個專為 **PVQC (Professional Vocabulary Quotient Credential) 專業英文詞彙能力國際認證 - 電機電子類** 設計的現代化純前端互動測驗與遊戲系統。免除後端依賴，可直接透過 **GitHub Pages** 零成本發布上線！

---

## 🌟 核心特色與遊戲模式

### 1. 🔀 打散代號配對模式 (核心指定功能)
* **題目與答案全打散**：左欄列出抽出之英文單字題號，右欄隨機打散對應之中文解釋並指派獨立代號（A、B、C...）。
* **多元作答支援**：
  * **鍵盤輸入**：支援代號輸入，自動轉大寫並智慧跳轉至下一題。
  * **點擊速填**：點選右側任一中文解釋卡片，系統即刻代入目前作答格，提升行動裝置作答便利性。
* **智慧分組檢視**：題數較多時自動切換每組 10 題分頁，避免視野過長影響配對效率。

### 2. 📝 PVQC 經典單選模式
* 官方競賽擬真介面，隨機抽取 3 個干擾選項，搭配即時對錯音效與視覺回饋。

### 3. 🧩 卡片速配消消樂
* 將英文單字與中文釋義混合於卡片網格，連續點擊消除，考驗快速聯想能力與反應速度。

### 4. ⌨️ 拼寫實戰挑戰
* 依據中文釋義、單字總長度與首尾字母提示，親手鍵入正確英文詞彙，強化專業拼寫能力。

### 5. 🔊 Web Speech 語音發音與錯題再測
* 內建語音朗讀合成技術（支援美式英文標準發音）。
* 測驗結算自動生成完整錯題清單，支援 **「僅重測此回錯題」** 專屬特訓機制。

---

## 📐 出題範圍與抽題規則

* **序號範圍**：可任意指定 1 ~ 793（提供 1-100、101-200、...、全部 793 等快捷按鈕）。
* **抽題邏輯**：
  * **出題數 $\ge$ 範圍總題數**：範圍內全考，並進行隨機洗牌（Fisher-Yates Shuffle）。
  * **出題數 $<$ 範圍總題數**：自指定範圍內均勻隨機抽取指定題數，題題不重複。

---

## 🚀 如何發布至您的 GitHub Pages

本專案為純靜態網頁（Vanilla HTML5 + CSS3 + ES6 JS），只要推送至 GitHub 即可在 1 分鐘內完成發布：

### 步驟 1：在 GitHub 上建立新儲存庫
1. 登入您的 [GitHub](https://github.com/) 帳號。
2. 點擊右上角 **「+」** $\rightarrow$ **「New repository」**。
3. 命名 Repository（例如 `PVQC_Test`），設定為 **Public**，**不要** 勾選「Add a README file」。
4. 點擊 **「Create repository」**，並複製該儲存庫的 Git 網址（例如 `https://github.com/<您的GitHub帳號>/PVQC_Test.git`）。

### 步驟 2：在本地終端機推送程式碼
在專案根目錄（`C:\Anti_Prj\PVQC_Test`）開啟終端機（PowerShell 或 Git Bash），依序執行：

```powershell
# 1. 初始化 Git 倉儲（若尚未初始化）
git init

# 2. 加入所有檔案並提交
git add .
git commit -m "feat: PVQC 電機電子測驗系統前端完整版本"

# 3. 設定主分支名稱為 main
git branch -M main

# 4. 關聯到您的 GitHub 儲存庫 (請將下列網址替換為您的實際網址)
git remote add origin https://github.com/<您的GitHub帳號>/PVQC_Test.git

# 5. 推送至 GitHub
git push -u origin main
```

### 步驟 3：啟用 GitHub Pages 免費網頁託管
1. 回到您在 GitHub 上的該儲存庫頁面，點擊上方的 **「Settings」**（設定）。
2. 在左側選單點擊 **「Pages」**。
3. 在 **「Build and deployment」** 下的 **「Branch」** 區塊：
   * 將分支選為 `main`。
   * 資料夾選擇 `/ (root)`。
   * 點擊 **「Save」**（儲存）。
4. 稍候約 1 ~ 2 分鐘重新整理頁面，GitHub 就會為您生成一個可供任何人連線使用的網址：
   > `https://<您的GitHub帳號>.github.io/PVQC_Test/`

---

## 📂 檔案目錄結構

```text
PVQC_Test/
├── data/
│   └── words.js               # 793 筆題庫結構化資料
├── css/
│   └── style.css              # 現代科技感樣式與響應式排版
├── js/
│   └── app.js                 # 核心抽題演算、四種遊戲模式與發音模組
├── scripts/
│   └── convert_data.js        # Markdown 題庫自動轉譯腳本
├── index.html                 # 遊戲主頁面
├── 電機電子793單字.md         # 原始單字庫
├── .gitignore                 # Git 忽略設定
└── README.md                  # 本說明文件
```
