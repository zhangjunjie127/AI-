import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "zh-CN" | "en-US";

const LANGUAGE_STORAGE_KEY = "putenggame:language";
const LANGUAGE_EVENT = "putenggame:language-changed";

const ZH: Record<string, string> = {
  "Back to app": "返回应用",
  "Settings sections": "设置分区",
  SETTINGS: "设置",
  "Providers & Models": "提供商和模型",
  Account: "账户",
  Appearance: "外观",
  "Web Search": "网页搜索",
  Network: "网络",
  Plugins: "插件",
  About: "关于",
  Billing: "账单",
  "Open billing dashboard": "打开账单面板",
  "Manage your PutengGame Cloud plan, usage, and payment details on the web.":
    "在网页上管理 PutengGame Cloud 方案、用量和支付信息。",
  Theme: "主题",
  System: "跟随系统",
  Light: "浅色",
  Dark: "深色",
  Workspace: "工作区",
  "Chat position": "聊天位置",
  "Chat panel position": "聊天面板位置",
  Left: "左侧",
  Right: "右侧",
  Language: "语言",
  "Interface language": "界面语言",
  "Signed in as": "当前登录账户",
  "Sign in": "登录",
  "Sign in for free daily quota": "登录后可获得每日免费额度",
  "Sign out": "退出登录",
  Version: "版本",
  Updates: "更新",
  "You're up to date": "已是最新版本",
  "Checking for updates...": "正在检查更新……",
  "Preparing a safe restart...": "正在准备安全重启……",
  "Not checked yet": "尚未检查",
  "Technical details": "技术详情",
  "Your projects and conversations were not deleted.":
    "你的项目和对话没有被删除。",
  "Download update": "下载更新",
  "Restart to update": "重启并更新",
  "Try again": "重试",
  "Network settings": "网络设置",
  Copied: "已复制",
  "Copy ID": "复制 ID",
  "Copy details": "复制详情",
  "Check for updates": "检查更新",
  Home: "首页",
  Projects: "项目",
  Library: "资源库",
  Community: "社区",
  STUDIOS: "工作室",
  "Web Game": "网页游戏",
  "Interactive Story": "互动影游",
  ...{
    Story: "故事地图",
    Design: "设计",
    Code: "代码",
    "Playable Nodes workspace": "互动影游工作区",
    "Playable Nodes code": "互动影游代码",
    "Project settings": "项目设置",
    "Playtest in a new window": "在新窗口试玩",
    "Opening playtest...": "正在打开试玩……",
    Playtest: "试玩",
    Publishing: "正在发布",
    Publish: "发布",
    "Show chat": "显示聊天",
    "Loading Scenes...": "正在加载场景……",
    "The project does not compile": "项目无法编译",
    "Scene title": "场景标题",
    "Open Scene editor": "打开场景编辑器",
    "The player starts here": "玩家从这里开始",
    "Off map": "不在地图上",
    Ending: "结局",
    Stale: "已过期",
    "No exits yet": "暂无出口",
    "Add Scene": "添加场景",
    "No Scenes yet": "暂无场景",
    "Start from a Template, or describe your story in the chat.":
      "从模板开始，或在聊天中描述你的故事。",
    "Add a Scene": "添加场景",
    "Canvas actions": "画布操作",
    "Scene actions": "场景操作",
    Undo: "撤销",
    Redo: "重做",
    Paste: "粘贴",
    Open: "打开",
    "Copy Scene": "复制场景",
    Duplicate: "复制副本",
    "Start Scene": "开始场景",
    "Set as Start": "设为开始场景",
    "On Story map": "显示在故事地图",
    Delete: "删除",
    Project: "项目",
    "Screen size": "屏幕尺寸",
    Variables: "变量",
    "About variables": "变量说明",
    Export: "导出",
    "Exporting...": "正在导出……",
    "Export game": "导出游戏",
    "Pick a starting point, then describe the Scene in chat.":
      "选择起点，然后在聊天中描述场景。",
    Close: "关闭",
    Replay: "重播",
    "Play from here": "从这里开始播放",
    "Play the preview": "播放预览",
    Select: "选择",
    "Arrange nodes": "一键整理",
    "Pick things to talk about with the AI. Shift-click to pick more.":
      "选择要与智能体讨论的内容。按住 Shift 键点击可多选。",
    Text: "文字",
    "Click text to change it": "点击文字进行修改",
    Move: "移动",
    "Drag things to move them": "拖动内容进行移动",
    Draw: "绘制",
    "Draw on the preview to show the AI what you mean":
      "在预览中绘制，向智能体说明你的意图",
    "Click to pick · Shift-click for more · Esc to play":
      "点击选择 · 按住 Shift 键可多选 · 按 Esc 键播放",
    "Click text to change it · Enter to keep · Esc to play":
      "点击文字进行修改 · 按 Enter 键保存 · 按 Esc 键播放",
    "Drag to move · Esc to play": "拖动移动 · 按 Esc 键播放",
    "Draw, then say what you want in the chat · Esc to play":
      "绘制后在聊天中说明需求 · 按 Esc 键播放",
    "Preview tools": "预览工具",
    "Undo stroke": "撤销笔画",
    "Clear drawing": "清除绘制内容",
    Drawing: "绘制内容",
    Media: "媒体",
    "Add an image or a video": "添加图片或视频",
    "Choose a background": "选择背景",
    "Add to chat": "添加到聊天",
    "Show it behind this Scene": "显示在此场景后方",
    "This Scene has no background to set; add it to the chat instead":
      "此场景没有可设置的背景，请改为添加到聊天",
    "As background": "设为背景",
    "Remove background": "移除背景",
    "Take the background off this Scene": "移除此场景的背景",
    "What happened in the preview": "预览中发生了什么",
    "Ask the AI to fix this": "让智能体修复此问题",
    Fix: "修复",
    Dismiss: "关闭提示",
    "Ask AI to fix": "让智能体修复",
    "Added to the chat in the editor": "已添加到编辑器聊天",
    "Something broke": "出现异常",
    "Forget seen Scenes": "忘记已看过的场景",
    "Forget which Scenes were seen, so the Story map starts over":
      "忘记已看过的场景，让故事地图重新开始",
    "Replay from the start with a new game": "从头开始重新游玩",
    Scene: "场景",
    "Untitled story": "未命名影游",
    Untitled: "未命名",
    "Made it": "成功",
    Missed: "失败",
    "Ask for a change": "提出修改",
    "Workspace views": "工作区视图",
    Model: "模型",
    "Model 3D": "3D 模型",
    "Review the plan above": "检查上面的计划",
    "Executing plan": "正在执行计划",
    "Describe what to plan": "描述要规划的内容",
    "Add a follow-up": "补充消息",
    "Send prompt": "发送提示",
    "Queue follow-up": "排队发送",
    "Selected text": "选中文本",
    "Remove selected text": "移除选中文本",
    "Game design": "游戏设计",
    "Referenced game design": "引用的游戏设计",
    "Remove game design reference": "移除游戏设计引用",
    "Publish game": "发布游戏",
    "Published game": "已发布游戏",
    "Game published": "游戏已发布",
    Cover: "封面",
    Automatic: "自动",
    Custom: "自定义",
    "Not applied": "未应用",
    "Loading cover...": "正在加载封面……",
    "The preview is captured automatically": "将自动截取预览作为封面",
    "Game cover preview": "游戏封面预览",
    "Replace cover": "替换封面",
    "Cancel selection": "取消选择",
    "Apply cover": "应用封面",
    "Restore automatic cover": "恢复自动封面",
    "Apply or cancel the selected cover before publishing.":
      "发布前请先应用或取消当前选择的封面。",
    "Automatic replacement is off.": "自动替换已关闭。",
    "The cover updates automatically with your project preview.":
      "封面会根据项目预览自动更新。",
    "This is your local project cover. Publish an update to change the Community cover.":
      "这是你的本地项目封面。发布更新即可更改社区封面。",
    Name: "名称",
    Description: "描述",
    "Describe what makes this game worth playing": "描述这款游戏值得游玩的原因",
    "Processing cover...": "正在处理封面……",
    "Saving cover...": "正在保存封面……",
    "Publishing...": "正在发布……",
    "Publish update": "发布更新",
    Landscape: "横屏",
    Portrait: "竖屏",
    Square: "方屏",
    "Review each Scene after changing screen size.":
      "更改屏幕尺寸后，请检查每个场景。",
    "What the game remembers between Scenes. Ask the AI to add or change these values.":
      "游戏在场景之间记住的内容。可以让智能体添加或修改这些值。",
    Starts: "初始值",
    "Nothing yet. The game doesn't remember anything between Scenes.":
      "暂无内容。游戏不会在场景之间记住任何内容。",
    "Save screen size changes before exporting.":
      "导出前请先保存屏幕尺寸更改。",
    Blank: "空白场景",
    "Main menu": "主菜单",
    Choice: "选择场景",
    "Option A": "选项 A",
    "Option B": "选项 B",
    QTE: "快速事件",
    Hotspot: "热点场景",
    "Story map": "故事地图",
    "A video or an image, then next": "视频或图片，播放后进入下一场景",
    "A title and a list of choices": "标题和选项列表",
    "Answers that lead different ways": "通往不同方向的选择",
    "Press in time, or miss": "及时按下按键，否则失败",
    "Spots on a picture to click": "点击图片中的热点",
    "The end, with Play again": "结局，以及再次游玩按钮",
    "The branches the player has found so far": "玩家目前发现的故事分支",
  },
  Godot: "Godot",
  "Asset Canvas": "资产画布",
  "General Game": "通用游戏",
  "Open account menu": "打开账户菜单",
  "Application menu": "应用菜单",
  "Current plan": "当前套餐",
  Trial: "体验版",
  "Points balance": "积分余额",
  "Upgrade plan": "升级套餐",
  "Buy points": "购买积分",
  "Choose a plan with more creation capacity. This is a demo checkout page.":
    "选择更高的创作额度。本页面为模拟购买页面。",
  "For occasional creation": "适合偶尔创作",
  "For regular creation": "适合日常创作",
  "For serious production": "适合专业制作",
  "1,000 points each month": "每月 1,000 积分",
  "3,000 points each month": "每月 3,000 积分",
  "10,000 points each month": "每月 10,000 积分",
  "Standard generation speed": "标准生成速度",
  "Priority generation speed": "优先生成速度",
  "Highest generation priority": "最高生成优先级",
  Popular: "热门",
  Choose: "选择",
  Selected: "已选择",
  "Plan selected. Checkout is simulated in this build.":
    "套餐已选择。本版本仅模拟结算流程。",
  "Purchase extra points for generation and production tasks. No real payment is made.":
    "购买额外积分，用于生成和制作任务。本页面不会产生真实支付。",
  "A small top-up": "小额充值",
  "A balanced top-up": "均衡充值",
  "For larger projects": "适合大型项目",
  "One-time purchase": "一次性购买",
  "Never expires": "永久有效",
  "Best value": "超值推荐",
  "Points package selected. Payment is simulated in this build.":
    "积分套餐已选择。本版本仅模拟支付流程。",
  Feedback: "意见反馈",
  "Personal profile": "个人资料",
  "Show your personal page and creator profile.":
    "展示你的个人主页和作品名片。",
  "Choose system avatar": "选择系统头像",
  "System avatars": "系统头像",
  "Display name": "昵称",
  "Shown on your profile and project comments": "显示在你的主页和作品评论中",
  Email: "邮箱",
  "Used for sign-in and important notifications": "用于登录和重要通知",
  "Personal website": "个人网站",
  "A public link on your profile": "显示在个人资料中的公开链接",
  Optional: "可选",
  "Gender display": "性别展示",
  "Optional and does not affect features": "可选，不影响任何功能",
  Male: "男",
  Female: "女",
  "Prefer not to say": "保密",
  Bio: "个人简介",
  "A short introduction, up to 150 characters":
    "一句话介绍你自己（150 字以内）",
  "Display name is required.": "请输入昵称。",
  "Profile saved.": "个人资料已保存。",
  "Discard changes": "放弃修改",
  "Save changes": "保存修改",
  "Saving...": "保存中……",
  "Security settings": "安全设置",
  "Notification preferences": "通知偏好",
  "Choose which channels and events you want to hear about.":
    "选择你希望接收通知的渠道与类型。",
  "Delivery channels": "接收渠道",
  "Email notifications": "邮件通知",
  "We'll send updates to your registered email": "将通知发送至你的注册邮箱",
  "In-app push": "站内推送",
  "Receive reminders inside PutengGame": "登录时通过站内消息提醒",
  "SMS notifications": "短信通知",
  "Receive important security alerts by text": "重要安全事件时发送短信",
  "Event types": "事件类型",
  "Community activity": "社区互动",
  "Comments, likes, and mentions": "评论、点赞、关注通知",
  "New followers": "新关注者",
  "When another user follows you": "其他用户关注你",
  "Weekly picks": "每周精选",
  "Community highlights delivered each week": "社区运营推送的每周精选",
  "Notification settings saved.": "通知设置已保存。",
  "Save notification settings": "保存通知设置",
  "Sign in to manage your account security.": "登录后管理账户安全。",
  "Change password": "修改密码",
  "We recommend changing your password every 6 months. Use at least 8 characters.":
    "建议每 6 个月更换一次密码，长度至少 8 位。",
  "Current password": "当前密码",
  "New password": "新密码",
  "Show password": "显示密码",
  "Hide password": "隐藏密码",
  "Enter your current and new password.": "请输入当前密码和新密码。",
  "The new password must be at least 8 characters.":
    "新密码至少需要 8 个字符。",
  "Password updated in demo mode.": "密码已在模拟模式下更新。",
  "Update password": "更新密码",
  "Verification methods": "验证方式",
  "Use extra verification steps to make your account safer. These controls are simulated in this build.":
    "推荐开启两步验证，提升账户安全。本版本中的功能为模拟操作。",
  "Email verified": "邮箱已验证",
  Verified: "已开启",
  Enabled: "已开启",
  "Phone verification": "手机号验证",
  "Not connected": "未绑定",
  "Not enabled": "未开启",
  "Bind phone": "绑定手机",
  "Enter a demo phone number": "输入模拟手机号",
  "Two-factor authentication": "两步验证",
  "Authenticator app verification is enabled": "通过验证器 App 校验登录",
  "Use an authenticator app when signing in": "通过验证器 App 校验登录",
  Enable: "启用",
  Disable: "停用",
  "System messages": "系统消息",
  "No system messages": "暂无系统消息",
  "System messages will appear here.": "系统消息会显示在这里。",
  "Account settings": "账户设置",
  "Manage sign-in and account security from your authentication provider.":
    "登录和账户安全由身份验证提供商管理。",
  "Choose how PutengGame keeps you informed about system messages and updates.":
    "选择扑腾如何向你发送系统消息和更新通知。",
  Available: "有可用更新",
  "Loading account": "正在加载账户",
  Update: "更新",
  Restart: "重启",
  Issue: "问题",
  "Resize sidebar": "调整侧边栏宽度",
  "Main navigation": "主导航",
  "What are we making today?": "今天要制作什么？",
  "Describe the game you want to create...": "描述你想制作的游戏……",
  "Start blank": "从空白开始",
  "What do you want to create?": "你想创建什么？",
  "Describe your game idea or what you want to build...":
    "描述你的游戏想法或想要构建的内容……",
  "New game project": "新建游戏项目",
  "What game are we making today?": "今天要制作什么游戏？",
  "Describe the browser game you want to create...": "描述你想创建的网页游戏……",
  "New game": "新建游戏",
  "What story are we telling today?": "今天要制作什么影游？",
  "Describe the interactive story you want to create...":
    "描述你想创建的互动影游……",
  "New story": "新建影游",
  "What are we building in Godot?": "我们要在 Godot 中构建什么？",
  "Describe the Godot game you want to create...":
    "描述你想创建的 Godot 游戏……",
  "New Godot project": "新建 Godot 项目",
  "Recent projects": "最近项目",
  Retry: "重试",
  "Show all": "查看全部",
  "No projects yet": "还没有项目",
  Explore: "探索",
  "Loading projects": "正在加载项目",
  "No projects match your search": "没有匹配搜索条件的项目",
  "Loading assets": "正在加载资源",
  "No assets match these filters": "没有匹配筛选条件的资源",
  "No media assets yet": "还没有媒体资源",
  "Delete asset everywhere?": "要从所有位置删除资源吗？",
  Cancel: "取消",
  "Delete everywhere": "从所有位置删除",
  "Deleting...": "正在删除……",
  "Rename asset": "重命名资源",
  "Loading games": "正在加载游戏",
  "No published games yet": "还没有已发布的游戏",
  Refresh: "刷新",
  "Save configuration": "保存配置",
  Saved: "已保存",
  "Open authorization page": "打开授权页面",
  "Preview logs": "预览日志",
  "Configuration fields": "配置字段",
  "MCP configuration": "MCP 配置",
  "MCP service configuration": "MCP 服务配置",
  "Preview mode": "预览模式",
  "Startup command": "启动命令",
  "Script arguments": "脚本参数",
  Command: "命令",
  "MCP URL": "MCP 地址",
  "Choose an available model or connect its provider in Settings":
    "请选择可用模型，或在设置中连接对应的提供商",
  "Loading web search settings...": "正在加载网页搜索设置……",
  "Web search settings saved.": "网页搜索设置已保存。",
  "Delete column": "删除列",
  "Delete row": "删除行",
  "Resize column": "调整列宽",
  Connected: "已连接",
  tools: "个工具",
  "No results": "没有结果",
  "Create project": "创建项目",
  Create: "创建",
  Save: "保存",
  Close: "关闭",
  Open: "打开",
  Edit: "编辑",
  Delete: "删除",
  Rename: "重命名",
  Copy: "复制",
  Done: "完成",
  Loading: "加载中",
  "Loading...": "加载中……",
  Error: "错误",
  "Something went wrong": "出现错误",
  "Could not reach the local runtime": "无法连接本地运行时",
  "Could not reach the local runtime.": "无法连接本地运行时。",
  Add: "添加",
  "Add MCP plugin": "添加 MCP 插件",
  "Add MCP service...": "添加 MCP 服务……",
  "Add Scene": "添加场景",
  "Add a Scene": "添加场景",
  "Add a model manually": "手动添加模型",
  "Add credentials for the public providers you use.":
    "为你使用的公共提供商添加凭据。",
  "Add files from this device": "从此设备添加文件",
  "Add model": "添加模型",
  "Add node": "添加节点",
  "Add provider": "添加提供商",
  "Add to chat": "添加到聊天",
  "Add to document": "添加到文档",
  "Add to project…": "添加到项目……",
  Advanced: "高级",
  All: "全部",
  "All projects": "所有项目",
  "All sources": "所有来源",
  "All types": "所有类型",
  "All uses": "所有用途",
  Assets: "资源",
  Authentication: "身份验证",
  Authorize: "授权",
  Auto: "自动",
  Automatic: "自动",
  "Automatic preview": "自动预览",
  "Automatic preview is disabled.": "自动预览已禁用。",
  Back: "返回",
  "Back to projects": "返回项目",
  "Back to canvas": "返回画布",
  "Background cleanup": "背景清理",
  "Balance unavailable. Refresh to try again.": "余额不可用。请刷新后重试。",
  "Base URL": "基础地址",
  "Base URL override": "覆盖基础地址",
  Boolean: "布尔值",
  "Build a plugin with the agent": "使用智能体构建插件",
  "Built-in": "内置",
  "Bypass proxy for": "以下地址绕过代理",
  "Cancel selection": "取消选择",
  "Candidate draft — review before replacing the table.":
    "候选草稿，替换表格前请先检查。",
  "Changes apply after the current conversation turn finishes.":
    "更改将在当前对话轮次结束后生效。",
  Clear: "清除",
  "Clear drawing": "清除绘图",
  "Clone a public HTTPS repository": "克隆公共 HTTPS 仓库",
  Column: "列",
  "Comma-separated. Local addresses always bypass.":
    "使用逗号分隔。本地地址始终绕过代理。",
  Compact: "压缩",
  "Compact this chat's context": "压缩此聊天的上下文",
  Complete: "完成",
  "Complete authorization": "完成授权",
  Configuration: "配置",
  "Configure with AI": "使用 AI 配置",
  "Connect a compatible server for web search.": "连接兼容的网页搜索服务器。",
  "Connect tools through a plugin": "通过插件连接工具",
  "Connection type": "连接类型",
  "Context window": "上下文窗口",
  Continue: "继续",
  "Continue building": "继续构建",
  "Continue with": "继续使用",
  "Copy Scene": "复制场景",
  "Copy error": "复制错误信息",
  "Copy node": "复制节点",
  "Copy relative path": "复制相对路径",
  Cover: "封面",
  "Create games with or without an account.": "无需账户也可以创建游戏。",
  "Create with AI": "使用 AI 创建",
  Custom: "自定义",
  "Custom MCP": "自定义 MCP",
  "Custom command": "自定义命令",
  "Daily quota": "每日配额",
  "Default language protocol": "默认语言协议",
  "Default models": "默认模型",
  "Default route": "默认路由",
  "Delete board": "删除画板",
  "Deleting it removes it from these projects. Code that still uses it will need a new asset. This cannot be undone.":
    "删除后会将其从这些项目中移除。仍在使用它的代码需要新的资源。此操作无法撤销。",
  "Describe your game in the agent panel to create a playable build.":
    "在智能体面板中描述你的游戏以创建可运行版本。",
  Description: "描述",
  Details: "详情",
  Device: "设备",
  "Error details": "错误详情",
  "Example ·": "示例 ·",
  Examples: "示例",
  Export: "导出",
  "File change failed without output.": "文件更改失败，但没有返回输出。",
  File: "文件",
  Filters: "筛选",
  Fit: "适应窗口",
  Fix: "修复",
  "From Library": "来自资源库",
  "From projects": "来自项目",
  "Game design": "游戏设计",
  "Game link": "游戏链接",
  Generated: "已生成",
  "Generation defaults": "生成默认值",
  "Generation template": "生成模板",
  "Hide all": "全部隐藏",
  "Hyper3D Rodin": "Hyper3D Rodin",
  "Image input": "图像输入",
  "Image models": "图像模型",
  "Image protocol": "图像协议",
  "Image settings": "图像设置",
  "Implement this plan?": "要执行此计划吗？",
  "Importing files": "正在导入文件",
  "Include references": "包含引用",
  Included: "已包含",
  Insert: "插入",
  "Install from Git...": "从 Git 安装……",
  "Install from folder...": "从文件夹安装……",
  Installed: "已安装",
  "Join the community": "加入社区",
  "Language settings": "语言设置",
  "Leave blank to use this provider's connection.":
    "留空以使用此提供商的连接。",
  "Loading Scenes...": "正在加载场景……",
  "Loading asset": "正在加载资源",
  "Loading canvas...": "正在加载画布……",
  "Loading configuration": "正在加载配置",
  "Loading configuration…": "正在加载配置……",
  "Loading game": "正在加载游戏",
  "Loading models": "正在加载模型",
  "Loading moves...": "正在加载动作……",
  "Loading plugin": "正在加载插件",
  "Loading plugins": "正在加载插件",
  "Loading preview": "正在加载预览",
  "Loading providers": "正在加载提供商",
  "Loading skill": "正在加载技能",
  "Local command": "本地命令",
  "Manage provider": "管理提供商",
  "Manage providers": "管理提供商",
  Management: "管理",
  "Max output tokens": "最大输出令牌数",
  "Max outputs": "最大输出数量",
  Media: "媒体",
  Meshy: "Meshy",
  Mobile: "移动端",
  "Model ID": "模型 ID",
  "Model capabilities": "模型能力",
  "Model catalog info": "模型目录信息",
  "Model display name": "模型显示名称",
  Models: "模型",
  "More games": "更多游戏",
  "More providers": "更多提供商",
  "More sharing options": "更多分享选项",
  Name: "名称",
  "Needs configuration": "需要配置",
  "Needs configuration:": "需要配置：",
  New: "新建",
  "New asset canvas": "新建资产画布",
  "New Asset Canvas": "新建资产画布",
  "Choose folder…": "选择文件夹……",
  "Choose another…": "选择其他文件夹……",
  "Opening…": "正在打开……",
  "New file": "新建文件",
  "New folder": "新建文件夹",
  "New project": "新建项目",
  "No API key": "没有 API 密钥",
  "No Scenes yet": "还没有场景",
  "No asset canvases yet": "还没有资产画布",
  "No exits yet": "还没有出口",
  "No installed plugins match your search.": "没有已安装的插件匹配搜索条件。",
  "No matches": "没有匹配项",
  "No matching conversations": "没有匹配的对话",
  "No matching items": "没有匹配的项目",
  "No models added yet.": "还没有添加模型。",
  "No models match your search.": "没有模型匹配搜索条件。",
  "No moves match your search": "没有动作匹配搜索条件",
  "No moves selected": "未选择动作",
  "No project": "没有项目",
  "No providers match these filters.": "没有提供商匹配这些筛选条件。",
  "No rows yet. Edit the table or describe what to generate below.":
    "还没有行。请编辑表格，或在下方描述要生成的内容。",
  "No video models are available.": "没有可用的视频模型。",
  "Node details": "节点详情",
  "Not applied": "未应用",
  "Not enough daily credits for this model. Choose a lower-cost tier.":
    "此模型的每日额度不足。请选择更低成本的档位。",
  Number: "数字",
  "Off map": "不在地图上",
  Official: "官方",
  "Official capabilities are fixed. Add a custom version to configure a different model.":
    "官方能力固定不变。添加自定义版本以配置其他模型。",
  "Official model versions": "官方模型版本",
  "On Story map": "在故事地图上",
  "Open Scene editor": "打开场景编辑器",
  "Open browser": "打开浏览器",
  "Open folder": "打开文件夹",
  "Open preview in browser": "在浏览器中打开预览",
  "Open project": "打开项目",
  "Open source file": "打开源文件",
  "Opening your workspace…": "正在打开工作区……",
  "Operation failed without output.": "操作失败，但没有返回输出。",
  "Optional field definitions (JSON)": "可选字段定义（JSON）",
  Output: "输出",
  PBR: "PBR",
  "PBR support": "PBR 支持",
  "Package manager": "包管理器",
  "Package script": "包脚本",
  "Paste MCP configuration": "粘贴 MCP 配置",
  Path: "路径",
  Plan: "计划",
  "Plan mode": "计划模式",
  Play: "播放",
  "Plugin name": "插件名称",
  "Preview actions": "预览操作",
  "Preview will appear here": "预览将在此处显示",
  Project: "项目",
  "Project files": "项目文件",
  "Project settings": "项目设置",
  Provider: "提供商",
  Providers: "提供商",
  Proxy: "代理",
  "Proxy URL": "代理地址",
  Publish: "发布",
  "Published successfully": "发布成功",
  "Quick start": "快速开始",
  Reasoning: "推理",
  "Reasoning levels": "推理级别",
  "Reasoning settings": "推理设置",
  "Recent canvases": "最近画布",
  "Recently updated": "最近更新",
  Recommended: "推荐",
  Redo: "重做",
  Reference: "引用",
  References: "引用",
  Reload: "重新加载",
  "Reload canvas": "重新加载画布",
  Remix: "再创作",
  "Remove background": "移除背景",
  "Remove saved key": "移除已保存的密钥",
  "Replace cover": "替换封面",
  Repository: "仓库",
  "Review changes": "检查更改",
  "Review message": "检查消息",
  Row: "行",
  "Save screen size changes before exporting.": "导出前保存屏幕尺寸更改。",
  "Save to Library": "保存到资源库",
  "Saved credentials are referenced by configuration fields.":
    "配置字段会引用已保存的凭据。",
  "Screen size": "屏幕尺寸",
  Send: "发送",
  "Share game": "分享游戏",
  "Show in Code": "在代码中显示",
  "Sign-in": "登录",
  Size: "尺寸",
  Skills: "技能",
  Skip: "跳过",
  Source: "来源",
  Start: "开始",
  "Start from an idea": "从想法开始",
  "Start with an empty workflow": "从空工作流开始",
  "Starting conversation": "正在开始对话",
  Status: "状态",
  Stop: "停止",
  Story: "剧情",
  "Table unavailable. Restore its file to load it again.":
    "表格不可用。恢复其文件后重新加载。",
  Text: "文本",
  Texture: "纹理",
  "Try it": "试用",
  "Try now": "立即试用",
  Type: "类型",
  Undo: "撤销",
  Upload: "上传",
  Uploaded: "已上传",
  Use: "使用",
  "Use an existing asset": "使用现有资源",
  "Use disk version": "使用磁盘版本",
  "Use fallback provider": "使用备用提供商",
  Variables: "变量",
  Video: "视频",
  "Video models": "视频模型",
  "Video protocol": "视频协议",
  View: "查看",
  "View all": "查看全部",
  "View in Community": "在社区中查看",
  "View logs": "查看日志",
  "Web preview": "网页预览",
  "Web search failed without output.": "网页搜索失败，但没有返回输出。",
  "Worked for": "工作了",
  "Workspace unavailable": "工作区不可用",
  "Yes, implement this plan": "是，执行此计划",
  "Your initial message was paused while the service restarted.":
    "服务重启期间，你的初始消息已暂停。",
};

const originalText = new WeakMap<
  Text,
  { source: string; translated: string }
>();
const originalAttributes = new WeakMap<
  Element,
  Map<string, { source: string; translated: string }>
>();
const TRANSLATED_ATTRIBUTES = [
  "aria-label",
  "aria-description",
  "title",
  "placeholder",
  "alt",
  "data-tooltip",
];

Object.assign(ZH, {
  Agent: "智能体",
  Thinking: "思考中",
  "Waiting to steer": "等待调整",
  "Stopped while thinking": "思考期间已停止",
  "Stopped before work began": "开始工作前已停止",
  "Connection refused": "连接被拒绝",
  "Send prompt": "发送提示",
  "Stop agent": "停止智能体",
  "Queue follow-up": "排队发送",
  "Add a follow-up": "补充消息",
  "Ask for a change": "提出修改",
  "Review the plan above": "检查上面的计划",
  "Executing plan": "正在执行计划",
  "Describe what to plan": "描述要规划的内容",
  "Could not read dropped folder": "无法读取拖入的文件夹",
  "Doesn't open anything yet": "暂时没有可打开的内容",
  "Nowhere to go back to": "没有可返回的场景",
  Next: "下一步",
  Door: "门",
  File: "文件",
  Edit: "编辑",
  View: "查看",
  Window: "窗口",
  Settings: "设置",
  "AI candidate draft": "AI 候选草稿",
  "AI table draft": "AI 表格草稿",
  API: "API",
  "API key": "API 密钥",
  "API key is configured": "API 密钥已配置",
  "API key models use your Hyper3D balance. Free account models remain available.":
    "API 密钥模型使用你的 Hyper3D 余额。免费账户模型仍可用。",
  "API key settings": "API 密钥设置",
  "API keys": "API 密钥",
  "About variables": "关于变量",
  "Add an image or a video": "添加图片或视频",
  "Add column": "添加列",
  "Add context": "添加上下文",
  "Add context or attach files": "添加上下文或附加文件",
  "Add from Library": "从资源库添加",
  "Add row": "添加行",
  "Add to project": "添加到项目",
  "Added to": "已添加到",
  "Animation clip": "动画片段",
  "As background": "作为背景",
  "Ask AI to fix": "让 AI 修复",
  "Ask Agent to fix": "让智能体修复",
  "Ask the AI to fix this": "让 AI 修复此问题",
  "Asset Canvas workspace": "资产画布工作区",
  "Attach images": "附加图片",
  "Attached files": "已附加文件",
  "Attached images": "已附加图片",
  "Automatic name": "自动命名",
  "Automatic, or [": "自动，或 [",
  "Available credits": "可用额度",
  "Available models": "可用模型",
  "Base URL settings": "基础地址设置",
  Breadcrumb: "面包屑导航",
  "Browser didn't return here? Paste the address it ended on.":
    "浏览器没有返回此处？请粘贴浏览器最终停留的地址。",
  "Cancel deletion": "取消删除",
  "Cancel generation": "取消生成",
  "Cancel plan": "取消计划",
  "Cancel rename": "取消重命名",
  "Candidate draft Markdown": "候选草稿 Markdown",
  "Candidate draft view": "候选草稿视图",
  "Canvas format": "画布格式",
  "Check again": "再次检查",
  "Choose a local plugin directory": "选择本地插件目录",
  "Choose a project": "选择项目",
  "Choose an option": "选择选项",
  "Choose how to open": "选择打开方式",
  "Choose how to open file": "选择文件打开方式",
  "Choose moves": "选择动作",
  "Choose the service that runs web searches.": "选择用于执行网页搜索的服务。",
  "Clear the drawing": "清除绘图",
  "Close Library picker": "关闭资源库选择器",
  "Close asset preview": "关闭资源预览",
  "Close filters": "关闭筛选器",
  "Close move picker": "关闭动作选择器",
  "Close preview logs": "关闭预览日志",
  "Close share dialog": "关闭分享对话框",
  "Close sign in": "关闭登录窗口",
  "Close the game window to return to the preview.": "关闭游戏窗口以返回预览。",
  "Coding workspace": "编码工作区",
  "Command failed without output.": "命令执行失败，但没有返回输出。",
  "Composer commands": "编辑器命令",
  Connect: "连接",
  "Connected providers": "已连接的提供商",
  "Context for the next message": "下一条消息的上下文",
  "Conversation history": "对话历史",
  "Conversation title": "对话标题",
  Conversations: "对话",
  "Copy a compatible template, then check its limits against the new version.":
    "复制兼容模板，然后根据新版本检查其限制。",
  "Copy candidate draft": "复制候选草稿",
  "Copy game link": "复制游戏链接",
  "Copy message": "复制消息",
  "Copy response": "复制回复",
  "Copy table as TSV": "将表格复制为 TSV",
  "Copy table draft": "复制表格草稿",
  "Copy this example into a new project you can change":
    "将此示例复制到新项目中进行修改",
  "Could not copy. Select the details above to copy them manually.":
    "无法复制。请选择上方详情并手动复制。",
  "Could not load moves.": "无法加载动作。",
  "Counted as an ending on the Story map": "在故事地图中计为结局",
  "Delete provider confirmation": "确认删除提供商",
  "Describe the table to create or change": "描述要创建或修改的表格",
  "Describe the video. Type @ to reference an image.":
    "描述视频。输入 @ 可引用图片。",
  "Describe what makes this game worth playing": "描述这款游戏值得游玩的原因",
  "Describe what to write or change": "描述要编写或修改的内容",
  "Describe what your plugin should do…": "描述你的插件应该做什么……",
  Disabled: "已禁用",
  Discard: "放弃",
  "Discard candidate draft": "放弃候选草稿",
  "Discard table draft": "放弃表格草稿",
  "Disconnect text": "断开文本连接",
  Dismiss: "忽略",
  "Dismiss notice": "忽略通知",
  "Display name": "显示名称",
  Document: "文档",
  "Document Markdown": "文档 Markdown",
  "Document not found": "未找到文档",
  "Document options": "文档选项",
  "Document title": "文档标题",
  "Document view": "文档视图",
  Download: "下载",
  "Download Markdown": "下载 Markdown",
  "Drop files": "拖放文件",
  "Drop files to attach": "拖放文件以附加",
  Duplicate: "复制副本",
  "Edit API key": "编辑 API 密钥",
  "Edit Base URL": "编辑基础地址",
  "Edit Markdown": "编辑 Markdown",
  "Edit candidate draft": "编辑候选草稿",
  "Edit message": "编辑消息",
  "Edit queued message": "编辑排队消息",
  "Edit table": "编辑表格",
  "Editor context": "编辑器上下文",
  "Enable the supported levels and set the parameter sent to your provider.":
    "启用支持的级别，并设置发送给提供商的参数。",
  Ending: "结局",
  Endpoint: "端点",
  English: "English",
  "Exact model version from your provider": "提供商提供的准确模型版本",
  "Exit plan mode": "退出计划模式",
  "Expand document": "展开文档",
  "Expand table": "展开表格",
  "Expand text": "展开文本",
  "Expanded document Markdown": "已展开文档 Markdown",
  "Expanded document title": "已展开文档标题",
  "Expanded table": "已展开表格",
  "Expanded text": "已展开文本",
  "Export CSV": "导出 CSV",
  "Filter assets": "筛选资源",
  "Filter files…": "筛选文件……",
  "Find page or enter path": "查找页面或输入路径",
  "Fit view": "适应视图",
  "Forget seen Scenes": "忘记已看过的场景",
  "Forget which Scenes were seen, so the Story map starts over":
    "忘记已看过的场景，让故事地图重新开始",
  "Free cloud": "免费云服务",
  Fullscreen: "全屏",
  "Generated or manually written text": "生成或手动编写的文本",
  "Global generation defaults": "全局生成默认值",
  HTTP: "HTTP",
  "Hide agent": "隐藏智能体",
  "Hide workspace": "隐藏工作区",
  "Import CSV": "导入 CSV",
  "Import CSV (replace table)": "导入 CSV（替换表格）",
  "Insert image": "插入图片",
  "Insert image from Library": "从资源库插入图片",
  Interrupted: "已中断",
  "JSON array; [] disables extra arguments.":
    "JSON 数组；[] 表示禁用额外参数。",
  "Keep my version": "保留我的版本",
  "Language Base URL override": "语言基础地址覆盖",
  "Language protocol": "语言协议",
  "Last published": "最近发布",
  "Leave blank to use this provider's connection.":
    "留空以使用此提供商的连接。",
  "Loading asset canvases": "正在加载资产画布",
  "Loading project": "正在加载项目",
  "Local debug publish. This link only works on this computer until the local runtime stops or restarts.":
    "本地调试发布。此链接仅在本地运行时停止或重启前对本机有效。",
  "Local providers": "本地提供商",
  "MCP services": "MCP 服务",
  "Match these limits to your provider's documentation. Local settings do not change upstream capabilities.":
    "请根据提供商文档填写这些限制。本地设置不会改变上游能力。",
  "Media types": "媒体类型",
  "Model settings": "模型设置",
  "Move categories": "动作分类",
  "Multiple images to 3D": "多图转 3D",
  "My provider": "我的提供商",
  "Network proxy mode": "网络代理模式",
  "Network status": "网络状态",
  "New conversation": "新建对话",
  "New plugin": "新建插件",
  "Next question": "下一题",
  "Node references": "节点引用",
  "Not shown on the Story map, and the Scenes before and after it are joined there":
    "不显示在故事地图上，前后场景会在那里连接",
  "Open file in default app": "使用默认应用打开文件",
  "Open game": "打开游戏",
  "Open in default app": "使用默认应用打开",
  "Open plugin": "打开插件",
  "Output truncated": "输出已截断",
  "Package structure": "包结构",
  "Pan canvas": "平移画布",
  Paste: "粘贴",
  "Pick a starting point, then describe the Scene in chat.":
    "选择起点，然后在聊天中描述场景。",
  "Plan approval": "计划审批",
  "Plan mode active": "计划模式已启用",
  "Planning questions": "计划问题",
  "Play from here": "从这里开始播放",
  "Play this Scene again from the start": "从头重新播放此场景",
  "Playable Nodes code": "互动影游代码",
  "Playable Nodes workspace": "互动影游工作区",
  "Players see this Scene on the Story map. Turn it off for menus and other Scenes that are not steps in the story.":
    "玩家会在故事地图中看到此场景。对于菜单和其他非故事步骤场景，请关闭此选项。",
  Playtest: "试玩",
  "Playtest defaults": "试玩默认值",
  "Plugin preview": "插件预览",
  "Plugin workspaces": "插件工作区",
  "Popular providers": "热门提供商",
  "Preview access": "预览访问权限",
  "Preview candidate draft": "预览候选草稿",
  "Preview document": "预览文档",
  "Preview is paused after service recovery.": "服务恢复后，预览已暂停。",
  "Preview pages": "预览页面",
  "Preview stopped because it was not in use.": "预览因未使用而停止。",
  "Preview table": "预览表格",
  "Preview tools": "预览工具",
  "Preview viewport": "预览视口",
  "Preview was stopped. Start it when you are ready.":
    "预览已停止。准备好后重新启动。",
  "Previous question": "上一题",
  "Project type": "项目类型",
  Prompt: "提示词",
  "Providers & Models": "提供商和模型",
  "Publish update": "发布更新",
  PutengGame: "扑腾",
  "Queued messages": "排队消息",
  "Redo table edit": "重做表格编辑",
  "Reference images": "参考图片",
  "Referenced game design": "引用的游戏设计",
  "Refresh API balance": "刷新 API 余额",
  "Refresh plugin preview": "刷新插件预览",
  "Refresh quota": "刷新配额",
  "Reload model catalog": "重新加载模型目录",
  "Reload the bundled official presets and account catalog":
    "重新加载内置官方预设和账户目录",
  "Remove game design reference": "移除游戏设计引用",
  "Remove move": "移除动作",
  "Remove plugin": "移除插件",
  "Remove queued message": "移除排队消息",
  "Remove selected text": "移除选中文本",
  "Remove skill": "移除技能",
  "Rename conversation": "重命名对话",
  "Replace document with draft": "用草稿替换文档",
  "Replace table with draft": "用草稿替换表格",
  Replay: "重播",
  "Replay from the start with a new game": "从头开始重新游玩",
  "Repository or marketplace URL": "仓库或市场 URL",
  "Requires one reference image and a source GLB.":
    "需要一张参考图片和一个源 GLB。",
  "Reset filters": "重置筛选器",
  "Reset node size": "重置节点大小",
  "Reset zoom": "重置缩放",
  "Resize agent panel": "调整智能体面板大小",
  "Resize file explorer": "调整文件浏览器大小",
  "Restore automatic cover": "恢复自动封面",
  "Restore defaults": "恢复默认设置",
  "Restore the workspace files, then reload.": "恢复工作区文件，然后重新加载。",
  "Result truncated": "结果已截断",
  "Results truncated": "结果已截断",
  "Retry canvas sync": "重试画布同步",
  "Retry failed. See details.": "重试失败。请查看详情。",
  "Retry saving canvas workspace": "重试保存画布工作区",
  "Retry syncing workspace changes": "重试同步工作区更改",
  "Retrying…": "正在重试……",
  "Return to game": "返回游戏",
  "Review canvas conflicts": "检查画布冲突",
  Rows: "行",
  "Save title": "保存标题",
  "Saved.": "已保存。",
  Saving: "正在保存",
  "Saving before closing…": "关闭前正在保存……",
  "Saving…": "正在保存……",
  "Scene title": "场景标题",
  "Search Library": "搜索资源库",
  "Search assets": "搜索资源",
  "Search conversations": "搜索对话",
  "Search models": "搜索模型",
  "Search moves": "搜索动作",
  "Search plugins": "搜索插件",
  "Search plugins...": "搜索插件……",
  "Search projects": "搜索项目",
  "Search providers": "搜索提供商",
  Select: "选择",
  "Select animation provider": "选择动画提供商",
  "Select document": "选择文档",
  "Selected moves, in clip order": "已选择动作，按片段顺序排列",
  "Selected text": "选中文本",
  "Selected text actions": "选中文本操作",
  "Send original message": "发送原始消息",
  "Separate values with commas.": "使用逗号分隔各项值。",
  "Server port": "服务器端口",
  "Set up an animation provider in": "在以下位置设置动画提供商：",
  "Show agent": "显示智能体",
  "Show chat": "显示聊天",
  "Show in Finder": "在 Finder 中显示",
  "Show workspace": "显示工作区",
  "Single image to 3D": "单图转 3D",
  "Skip questions": "跳过问题",
  "Smart topology": "智能拓扑",
  "Sort projects": "排序项目",
  Stale: "已过期",
  Standard: "标准",
  "Start from": "开始于",
  "Start from a Template, or describe your story in the chat.":
    "从模板开始，或在聊天中描述你的故事。",
  "Startup configuration": "启动配置",
  "Startup directory": "启动目录",
  "Startup script": "启动脚本",
  "Static files": "静态文件",
  Steer: "引导",
  "Steer current run": "引导当前运行",
  "Stop unused preview after": "在以下时间后停止未使用的预览",
  Stopped: "已停止",
  "Submit answer": "提交答案",
  "Table editor": "表格编辑器",
  "Table preview": "表格预览",
  "Table title": "表格标题",
  "Table view": "表格视图",
  Tablet: "平板",
  "Take the background off this Scene": "移除此场景的背景",
  "Tell PutengGame what to do differently": "告诉扑腾需要做出哪些不同调整",
  "Test connections": "测试连接",
  "Text output": "文本输出",
  "Texture support": "纹理支持",
  "The OpenAI-compatible API address or relay URL. Configure a Clash network proxy in Settings → Network.":
    "OpenAI 兼容 API 地址或中转 URL。请在设置 → 网络中配置 Clash 网络代理。",
  "The Scene changed since this picture was taken.":
    "此场景在拍摄此图片后发生了变化。",
  "The Story map counts this Scene as an ending": "故事地图将此场景计为结局",
  "The file is copied into the project’s assets folder.":
    "文件已复制到项目的资源文件夹。",
  "The player starts here": "玩家从这里开始",
  "The project does not compile": "项目无法编译",
  "The prompt will be added to a new conversation.": "提示词将添加到新对话中。",
  "The tool call failed without output.": "工具调用失败，但没有返回输出。",
  "This is your local project cover. Publish an update to change the Community cover.":
    "这是你的本地项目封面。发布更新即可更改社区封面。",
  "This run was interrupted. Your conversation and files are saved; send a message to continue.":
    "此次运行已中断。你的对话和文件已保存；发送消息即可继续。",
  Title: "标题",
  "Tool name": "工具名称",
  "Undo stroke": "撤销笔画",
  "Undo table edit": "撤销表格编辑",
  "Undo the last stroke": "撤销上一个笔画",
  "Uninstall plugin": "卸载插件",
  Topology: "拓扑",
  "Topology mode": "拓扑模式",
  Unassigned: "未分配",
  "Use the API endpoint, including /v1 when your service requires it.":
    "使用 API 端点；如果服务要求，请包含 /v1。",
  "Use the provider": "使用此提供商",
  "Use this model for": "将此模型用于",
  "Video prompt": "视频提示词",
  "Video settings": "视频设置",
  "Web search": "网页搜索",
  "Web search provider": "网页搜索提供商",
  "What happened in the preview": "预览中发生了什么",
  "What do you want to create?": "你想创建什么？",
  "Workspace files": "工作区文件",
  "Workspace navigation": "工作区导航",
  "You can retry this view or return to your projects.":
    "你可以重试此页面或返回项目。",
  "Zoom in": "放大",
  "Zoom out": "缩小",
} as Record<string, string>);

// Design and Asset Canvas UI labels. Model names and user-authored content are
// intentionally left untouched.
Object.assign(ZH, {
  "New asset canvas": "新建资产画布",
  "Quick start": "快速开始",
  "Recent canvases": "最近画布",
  "No asset canvases yet": "暂无资产画布",
  "Loading asset canvases": "正在加载资产画布",
  "Start with an empty workflow": "从空工作流开始",
  "Manage providers": "管理提供商",
  Retry: "重试",
  Assets: "资源",
  "Write a reusable prompt": "编写可复用的提示词",
  "Generate an image on canvas": "在画布上生成图片",
  "Generate a video on canvas": "在画布上生成视频",
  "Generate a 3D model on canvas": "在画布上生成 3D 模型",
  "Rig a 3D character and add moves": "为 3D 角色绑定骨骼并添加动作",
  Documents: "文档",
  "Existing document": "已有文档",
  "Add a document reference": "添加文档引用",
  "Markdown document": "Markdown 文档",
  "Untitled document": "未命名文档",
  "No model yet": "暂无模型",
  Table: "表格",
  "Editable game data": "可编辑的游戏数据",
  "Existing table": "已有表格",
  "Add a shared table reference": "添加共享表格引用",
  "Shared table": "共享表格",
  "Untitled table": "未命名表格",
  "Asset Canvas workspace": "资产画布工作区",
  "Design workspace": "设计工作区",
  Canvas: "画布",
  Code: "代码",
  "Workspace mode": "工作区模式",
  Home: "首页",
  "Show chat": "显示聊天",
  Saved: "已保存",
  Saving: "正在保存",
  "Saving…": "正在保存……",
  Loading: "正在加载",
  "Could not load": "无法加载",
  "Save failed": "保存失败",
  "Save failed · Retry": "保存失败 · 重试",
  "Sync paused · Retry": "同步已暂停 · 重试",
  "Draft kept locally": "草稿已保存在本地",
  "Review changes": "检查更改",
  "Review canvas conflicts": "检查画布冲突",
  "Retry saving canvas workspace": "重试保存画布工作区",
  "Retry canvas sync": "重试画布同步",
  "Retry syncing workspace changes": "重试同步工作区更改",
  "Retry sync": "重试同步",
  "Could not complete this action.": "无法完成此操作。",
  "Could not reconnect. Your canvas is still open.":
    "无法重新连接。你的画布仍处于打开状态。",
  "Could not load workspace.": "无法加载工作区。",
  "Could not save documents. Your drafts are kept.":
    "无法保存文档。你的草稿已保留。",
  "Could not save tables. Your drafts are kept.":
    "无法保存表格。你的草稿已保留。",
  "Restore the workspace files, then reload.": "恢复工作区文件，然后重新加载。",
  "Use disk version": "使用磁盘版本",
  "Keep my version": "保留我的版本",
  "New board": "新建画板",
  "Rename board": "重命名画板",
  "Delete board": "删除画板",
  Board: "画板",
  "Board options": "画板选项",
  Rename: "重命名",
  "Move up": "上移",
  "Move down": "下移",
  'Delete "': "删除“",
  "Documents and Library assets will be kept.":
    "文档和资源库中的资源将会保留。",
  "Select document": "选择文档",
  "Add text to document": "向文档添加文字",
  Insert: "插入",
  "Insert image": "插入图片",
  Close: "关闭",
  Cancel: "取消",
  Save: "保存",
  Name: "名称",
  Description: "描述",
  "Automatic name": "自动命名",
  "Node details": "节点详情",
  "Text output": "文本输出",
  "Generated or manually written text": "生成或手动编写的文本",
  "Text generation instruction": "文本生成指令",
  "Describe the text you want to generate": "描述你想生成的文本",
  "Generate text": "生成文本",
  "Generate document": "生成文档",
  "Retry document generation": "重试生成文档",
  "Candidate draft Markdown": "候选草稿 Markdown",
  "Candidate draft view": "候选草稿视图",
  "Candidate draft — review before replacing the document.":
    "候选草稿，请在替换文档前检查。",
  "Incomplete draft — review before replacing the document.":
    "草稿不完整，请在替换文档前检查。",
  "Edit candidate draft": "编辑候选草稿",
  "Preview candidate draft": "预览候选草稿",
  "Copy candidate draft": "复制候选草稿",
  "Discard candidate draft": "放弃候选草稿",
  "Replace document with draft": "用草稿替换文档",
  "Use draft": "使用草稿",
  "Draft copied.": "草稿已复制。",
  "Could not copy the draft.": "无法复制草稿。",
  "Could not copy. Select the draft text and copy it manually.":
    "无法复制。请选择草稿文本并手动复制。",
  "Document not found": "未找到文档",
  "Document unavailable": "文档不可用",
  "Document generation instruction": "文档生成指令",
  "Describe what to write or change": "描述要编写或修改的内容",
  "Edit Markdown": "编辑 Markdown",
  "Preview document": "预览文档",
  "Split view": "分栏视图",
  "Expanded document Markdown": "展开的文档 Markdown",
  "Expanded document title": "展开的文档标题",
  "Insert image from Library": "从资源库插入图片",
  "Download Markdown": "下载 Markdown",
  "Document options": "文档选项",
  "Main design document": "主设计文档",
  "Set as main design document": "设为主设计文档",
  "Back to canvas": "返回画布",
  "Missing document": "缺少文档",
  "Image unavailable": "图片不可用",
  "Check again": "再次检查",
  "Table generation instruction": "表格生成指令",
  "Describe the table to create or change": "描述要创建或修改的表格",
  "Generate table": "生成表格",
  "Retry table generation": "重试生成表格",
  "AI table draft": "AI 表格草稿",
  "Table preview": "表格预览",
  "Table editor": "表格编辑器",
  "Table title": "表格标题",
  "Table view": "表格视图",
  "Edit table": "编辑表格",
  "Expand table": "展开表格",
  "Copy table draft": "复制表格草稿",
  "Discard table draft": "放弃表格草稿",
  "Replace table with draft": "用草稿替换表格",
  "Copy table as TSV": "将表格复制为 TSV",
  "Export CSV": "导出 CSV",
  "Import CSV": "导入 CSV",
  "Import CSV (replace table)": "导入 CSV（替换表格）",
  "Undo table edit": "撤销表格编辑",
  "Redo table edit": "重做表格编辑",
  "Add row": "添加行",
  "Add column": "添加列",
  Rows: "行",
  "Delete column": "删除列",
  "Delete row": "删除行",
  Text: "文本",
  Image: "图片",
  Number: "数字",
  Boolean: "布尔值",
  "Could not copy the table.": "无法复制表格。",
  "Table copied.": "表格已复制。",
  "The table is too large.": "表格过大。",
  "No rows yet. Edit the table or describe what to generate below.":
    "暂无行。请编辑表格，或在下方描述要生成的内容。",
  "Table unavailable. Restore its file to load it again.":
    "表格不可用。恢复其文件后重新加载。",
  "Image model": "图片模型",
  "Image aspect ratio": "图片宽高比",
  "Image resolution": "图片分辨率",
  "Unavailable model": "模型不可用",
  "Select model": "选择模型",
  "No image model": "没有图片模型",
  "Video model": "视频模型",
  "Video reference mode": "视频参考模式",
  "Image references": "图片参考",
  "First / last frame": "首帧 / 尾帧",
  "First frame": "首帧",
  "Last frame": "尾帧",
  "Video aspect ratio": "视频宽高比",
  "Video resolution": "视频分辨率",
  "Video duration": "视频时长",
  "No video model": "没有视频模型",
  "Add reference images": "添加参考图片",
  "Add a reference image below, then generate":
    "请先在下方添加参考图片，再生成",
  "No language model": "没有语言模型",
  "Could not load models": "无法加载模型",
  "Loading models...": "正在加载模型……",
  "No matching models": "没有匹配的模型",
  "Search models": "搜索模型",
  Models: "模型",
  Reasoning: "推理",
  "Reasoning levels": "推理级别",
  "Animation provider": "动画提供商",
  "Select animation provider": "选择动画提供商",
  "Choose moves": "选择动作",
  "Search moves": "搜索动作",
  "Move categories": "动作分类",
  All: "全部",
  "No moves match your search": "没有匹配搜索条件的动作",
  "No moves selected": "未选择动作",
  "Selected moves, in clip order": "已选择动作，按片段顺序排列",
  Done: "完成",
  "Remove move": "移除动作",
  "Close move picker": "关闭动作选择器",
  "Connect a 3D model, pick moves, then animate":
    "连接 3D 模型，选择动作，然后生成动画",
  "Connect a humanoid 3D model, pick moves, then animate":
    "连接人形 3D 模型，选择动作，然后生成动画",
  "Rigging and animating...": "正在绑定骨骼并生成动画……",
  "Loading moves...": "正在加载动作……",
  "Could not load moves.": "无法加载动作。",
  "Set up an animation provider in": "请先在以下位置设置动画提供商：",
  "to browse moves.": "，然后浏览动作。",
  "This provider": "此提供商",
  "provides preset moves without visual previews.":
    "提供预设动作，但没有可视化预览。",
  "Rig version": "绑定版本",
  "Rig type": "绑定类型",
  "In place": "原地",
  "1 move": "1 个动作",
  "3D operation": "3D 操作",
  "Image to 3D": "图片转 3D",
  "Text to 3D": "文字转 3D",
  Retexture: "重新贴图",
  Remesh: "重新网格化",
  "Processing connection": "处理连接",
  "Select connection": "选择连接",
  "No 3D model": "没有 3D 模型",
  Polycount: "面数",
  PBR: "PBR",
  "Character height": "角色高度",
  "Character pose": "角色姿态",
  "Default pose": "默认姿态",
  "A / T pose": "A / T 姿态",
  "A pose": "A 姿态",
  "T pose": "T 姿态",
  "Texture quality": "纹理质量",
  "Texture version": "纹理版本",
  "Requires one reference image and a source GLB.":
    "需要一张参考图片和一个源 GLB。",
  "This can take a few minutes": "可能需要几分钟",
  "This can take a moment": "可能需要一些时间",
  "Connect a source model and choose a face count": "连接源模型并选择面数",
  "Connect a source model and describe or reference its new texture":
    "连接源模型，并描述或引用新的纹理",
  "Describe a 3D model below, then generate": "在下方描述 3D 模型，然后生成",
  "Generated image": "已生成图片",
  "Generated 3D model": "已生成 3D 模型",
  "Asset unavailable": "资源不可用",
  "Library image": "资源库图片",
  Audio: "音频",
  "Connected Text node is empty": "已连接的文本节点为空",
  "Connected images must be PNG, JPEG, or WebP.":
    "连接的图片必须是 PNG、JPEG 或 WebP。",
  "Could not read the connected image.": "无法读取连接的图片。",
  "Could not read video cover": "无法读取视频封面",
  "Each reference image must be no larger than 10 MB.":
    "每张参考图片不能超过 10 MB。",
  "The upload must be no larger than 200 MB.": "上传文件不能超过 200 MB。",
  "Upload a PNG, JPEG, WebP, MP4, MOV, WebM, MP3, or WAV file.":
    "请上传 PNG、JPEG、WebP、MP4、MOV、WebM、MP3 或 WAV 文件。",
  "Use PNG, JPEG, or WebP reference images.":
    "请使用 PNG、JPEG 或 WebP 格式的参考图片。",
  "Loading asset...": "正在加载资源……",
  "Add node": "添加节点",
  "Add asset": "添加资源",
  Upload: "上传",
  "Uploading...": "正在上传……",
  "Add files from this device": "从此设备添加文件",
  "From Library": "来自资源库",
  "Use an existing asset": "使用现有资源",
  "Drop files": "拖放文件",
  "Importing files": "正在导入文件",
  "Loading canvas...": "正在加载画布……",
  "Reload canvas": "重新加载画布",
  "Could not load canvas.": "无法加载画布。",
  "Canvas actions": "画布操作",
  "Node actions": "节点操作",
  "Add to document": "添加到文档",
  View: "查看",
  Download: "下载",
  "Add to project…": "添加到项目……",
  "Copy node": "复制节点",
  Duplicate: "复制副本",
  Delete: "删除",
  Undo: "撤销",
  Redo: "重做",
  Paste: "粘贴",
  "Could not save canvas. Your draft is kept.":
    "无法保存画布。你的草稿已保留。",
  "Could not import or paste some items.": "无法导入或粘贴部分内容。",
  'Add "': "添加“",
  "to a project": "”到项目",
  "Search Library": "搜索资源库",
  "No assets match your search": "没有匹配搜索条件的资源",
  "No assets in Library": "资源库中没有资源",
  Reference: "参考",
  References: "参考内容",
  "Include references": "包含参考内容",
  Source: "来源",
  Library: "资源库",
  Generated: "已生成",
  Uploaded: "已上传",
  "From projects": "来自项目",
  "All sources": "全部来源",
  "No project": "无项目",
  "All uses": "所有用途",
  Filters: "筛选器",
  "Filter assets": "筛选资源",
  "Close filters": "关闭筛选器",
  "Reset filters": "重置筛选器",
  "All assets": "全部资源",
  Images: "图片",
  Videos: "视频",
  "3D models": "3D 模型",
  "Project file": "项目文件",
  "Built-in": "内置",
  "Unknown source": "未知来源",
  "Save to Library": "保存到资源库",
  "Asset actions": "资源操作",
  "Open project": "打开项目",
  "Show in Code": "在代码中显示",
  "Loading asset": "正在加载资源",
  Type: "类型",
  Size: "大小",
  Projects: "项目",
  Project: "项目",
  Path: "路径",
  "Add to project": "添加到项目",
  "Search projects": "搜索项目",
  "Loading projects": "正在加载项目",
  "No matching projects": "没有匹配的项目",
  "No game projects yet": "暂无游戏项目",
  "Retry failed. See details.": "重试失败。请查看详情。",
  Details: "详情",
  "Dismiss notice": "忽略通知",
  "Retrying…": "正在重试……",
  "Checking…": "正在检查……",
  Animate: "生成动画",
  "Animate again": "再次生成动画",
  "Cancel generation": "取消生成",
  "Animated 3D model": "已生成动画的 3D 模型",
  "The file is copied into the project’s assets folder.":
    "文件已复制到项目的资源文件夹。",
  "Text documents cannot exceed 1 MB.": "文本文件不能超过 1 MB。",
  "Could not create a document.": "无法创建文档。",
  "Document and table references can only be pasted into boards in the same project.":
    "文档和表格引用只能粘贴到同一项目的画板中。",
  "Upload a PNG, JPEG, SVG, WebP, MP4, MOV, WebM, MP3, or WAV file.":
    "请上传 PNG、JPEG、SVG、WebP、MP4、MOV、WebM、MP3 或 WAV 文件。",
  "Could not download": "无法下载",
  "Could not send asset": "无法发送资源",
  "Unsupported Asset Canvas Node type": "不支持的资产画布节点类型",
  Fast: "快速",
  Standard: "标准",
  Detailed: "精细",
  Extreme: "极致",
  Biped: "双足",
  Quadruped: "四足",
  Hexapod: "六足",
  Octopod: "八足",
  Serpentine: "蛇形",
  Aquatic: "水生",
  "Fit view": "适应视图",
  "Pan canvas": "平移画布",
  "Zoom out": "缩小",
  "Reset zoom": "重置缩放",
  "Zoom in": "放大",
} as Record<string, string>);

export function readLanguage(): Language {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en-US"
      ? "en-US"
      : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

export function setLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The current session still works when storage is unavailable.
  }
  applyLanguage(language);
  window.dispatchEvent(
    new CustomEvent<Language>(LANGUAGE_EVENT, { detail: language }),
  );
}

export function translateText(value: string, language: Language): string {
  if (language === "en-US") return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.slice(
    leading.length,
    value.length - trailing.length || undefined,
  );
  const exact = ZH[core];
  if (exact) return `${leading}${exact}${trailing}`;
  const dynamic = translateDynamic(core);
  return `${leading}${dynamic}${trailing}`;
}

export function applyLanguage(
  language: Language,
  root: ParentNode = document,
): void {
  if (root instanceof Document) root.documentElement.lang = language;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (parent && !parent.closest("script, style, code, pre, textarea, input"))
      texts.push(node as Text);
  }
  texts.forEach((text) => {
    const current = text.nodeValue ?? "";
    const tracked = originalText.get(text);
    const source =
      tracked && current === tracked.translated ? tracked.source : current;
    const next = translateText(source, language);
    originalText.set(text, { source, translated: next });
    if (text.nodeValue !== next) text.nodeValue = next;
  });

  const elements =
    root instanceof Element
      ? [root, ...Array.from(root.querySelectorAll("*"))]
      : Array.from(root.querySelectorAll("*"));
  elements.forEach((element) => {
    if (element.matches("script, style, code, pre")) return;
    let attributes = originalAttributes.get(element);
    if (!attributes) {
      attributes = new Map();
      originalAttributes.set(element, attributes);
    }
    for (const name of TRANSLATED_ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value === null) continue;
      const tracked = attributes.get(name);
      const source =
        tracked && value === tracked.translated ? tracked.source : value;
      const next = translateText(source, language);
      attributes.set(name, { source, translated: next });
      if (value !== next) element.setAttribute(name, next);
    }
  });
}

function translateFragment(value: string): string {
  return ZH[value] ?? translateDynamic(value);
}

function translateDynamic(value: string): string {
  let next = value;
  next = next.replaceAll("PutengGame Cloud", "扑腾云");
  next = next.replaceAll("PutengGame", "扑腾");
  next = next.replace(/^Node (\d+)$/, "节点 $1");
  next = next.replace(/^Node$/, "节点");
  next = next.replace(/^Reference (\d+)$/, "参考图 $1");
  next = next.replace(/^blank-(\d+)$/, "空白场景 $1");
  next = next.replace(
    /^Would open (.+)$/,
    (_, value: string) => `将打开${translateFragment(value)}`,
  );
  next = next.replace(
    /^Open (.+)$/,
    (_, value: string) => `打开${translateFragment(value)}`,
  );
  next = next.replace(
    /^Agent (Stopping|Working)$/,
    (_, state: string) =>
      `智能体${state === "Stopping" ? "正在停止" : "工作中"}`,
  );
  next = next.replace(/^Edited just now$/, "刚刚编辑");
  next = next.replace(
    /^Edited (\d+)m ago$/,
    (_, value: string) => `${value} 分钟前编辑`,
  );
  next = next.replace(
    /^Edited (\d+)h ago$/,
    (_, value: string) => `${value} 小时前编辑`,
  );
  next = next.replace(
    /^Edited (\d+)d ago$/,
    (_, value: string) => `${value} 天前编辑`,
  );
  next = next.replace(
    /^Edited (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})(?:, (\d{4}))?$/,
    (_, month: string, day: string, year?: string) => {
      const months: Record<string, string> = {
        Jan: "1月",
        Feb: "2月",
        Mar: "3月",
        Apr: "4月",
        May: "5月",
        Jun: "6月",
        Jul: "7月",
        Aug: "8月",
        Sep: "9月",
        Oct: "10月",
        Nov: "11月",
        Dec: "12月",
      };
      return `于${year ? `${year}年` : ""}${months[month]}${day}日编辑`;
    },
  );
  next = next.replace(
    /^(Interactive Story|General Game|Browser Game|Godot Game|Asset Canvas|Plugin) · (.+)$/,
    (_, type: string, date: string) =>
      `${translateFragment(type)} · ${translateFragment(date)}`,
  );
  next = next.replace(
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}) (AM|PM)$/,
    (
      _,
      month: string,
      day: string,
      year: string,
      hour: string,
      minute: string,
      meridiem: string,
    ) => {
      const months: Record<string, string> = {
        Jan: "1月",
        Feb: "2月",
        Mar: "3月",
        Apr: "4月",
        May: "5月",
        Jun: "6月",
        Jul: "7月",
        Aug: "8月",
        Sep: "9月",
        Oct: "10月",
        Nov: "11月",
        Dec: "12月",
      };
      const numericHour = (Number(hour) % 12) + (meridiem === "PM" ? 12 : 0);
      return `${year}年${months[month]}${day}日 ${String(numericHour).padStart(2, "0")}:${minute}`;
    },
  );
  next = next.replace(
    /^(qte|blank|choice|hotspot|ending|story-map|main-menu)$/,
    (_, id: string) =>
      ({
        qte: "快速事件",
        blank: "空白场景",
        choice: "选择",
        hotspot: "热点场景",
        ending: "结局",
        "story-map": "故事地图",
        "main-menu": "主菜单",
      })[id] ?? id,
  );
  next = next.replace(/^Working for (\d+)s$/, "工作了 $1 秒");
  next = next.replace(/^Worked for (\d+)s$/, "已工作 $1 秒");
  next = next.replace(/^Working for (.+)$/, "工作了 $1");
  next = next.replace(/^Worked for (.+)$/, "已工作 $1");
  next = next.replace(/^You stopped after (.+)$/, "你在 $1 后停止");
  next = next.replace(/^Reconnecting (\d+)\/(\d+)$/, "正在重连 $1/$2");
  next = next.replace(
    /^Connection lost\. Reconnecting\.\.\.$/,
    "连接已断开，正在重连……",
  );
  next = next.replace(
    /^Reconnecting to the background service…$/,
    "正在重连后台服务……",
  );
  next = next.replace(
    /^Edge from (.+) to (.+)$/,
    (_, from: string, to: string) =>
      `从${translateFragment(from)}到${translateFragment(to)}的连线`,
  );
  next = next.replace(
    /^Stop unused preview after (.+)$/,
    "在 $1 后停止未使用的预览",
  );
  next = next.replace(/^(\d+)s$/, "$1 秒");
  next = next.replace(/^(\d+)m$/, "$1 分钟");
  next = next.replace(/^(\d+)h$/, "$1 小时");
  next = next.replace(/^Scene (\d+)$/, "场景 $1");
  next = next.replace(
    /^(.+) workbench$/,
    (_, value: string) => `${translateFragment(value)}编辑器`,
  );
  next = next.replace(
    /^(.+) live preview$/,
    (_, value: string) => `${translateFragment(value)}实时预览`,
  );
  next = next.replace(
    /^Remove (.+) from the message$/,
    (_, value: string) => `从消息中移除${translateFragment(value)}`,
  );
  next = next.replace(
    /^Project actions for (.+)$/,
    (_, value: string) => `项目操作：${translateFragment(value)}`,
  );
  next = next.replace(
    /^(Landscape|Portrait|Square|Custom) (\d+:\d+) · (\d+) x (\d+)$/,
    (_, format: string, ratio: string, width: string, height: string) => {
      const labels: Record<string, string> = {
        Landscape: "横屏",
        Portrait: "竖屏",
        Square: "方屏",
        Custom: "自定义",
      };
      return `${labels[format] ?? format} ${ratio} · ${width} x ${height}`;
    },
  );
  next = next.replace(/^Starts (.+)$/, "初始值 $1");
  next = next.replace(/^Update available: (.+)$/, "有可用更新：$1");
  next = next.replace(/^Downloading update \((.+)\)$/, "正在下载更新（$1）");
  next = next.replace(/^Ready to restart: (.+)$/, "可以重启更新：$1");
  next = next.replace(
    /^Play (Video|Image|3D model)$/,
    (_, value: string) =>
      `播放${value === "Video" ? "视频" : value === "Image" ? "图片" : " 3D 模型"}`,
  );
  next = next.replace(/^Connected · (\d+) tools?$/, "已连接 · $1 个工具");
  next = next.replace(
    /^Delete “(.+)” from Library\? This cannot be undone\.$/,
    "要从资源库删除“$1”吗？此操作无法撤销。",
  );
  next = next.replace(/^Could not save canvas: (.+)$/, "无法保存画布：$1");
  next = next.replace(/^Could not add to (.+): (.+)$/, "无法添加到$1：$2");
  next = next.replace(/^Could not load canvas\. (.+)$/, "无法加载画布。$1");
  next = next.replace(/^Image unavailable: (.+)$/, "图片不可用：$1");
  next = next.replace(/^Document unavailable: (.+)$/, "文档不可用：$1");
  next = next.replace(
    /^Document “(.+)” changed elsewhere\. Choose a version to resume saving\.$/,
    "文档“$1”已在其他位置更改。请选择一个版本以继续保存。",
  );
  next = next.replace(
    /^This mode supports up to (\d+) images\. Remove extra images or switch reference mode\.$/,
    "此模式最多支持 $1 张图片。请移除多余图片或切换参考模式。",
  );
  next = next.replace(
    /^Table “(.+)” changed elsewhere\. Your draft is kept; choose a version to resume saving\.$/,
    "表格“$1”已在其他位置更改。你的草稿已保留，请选择一个版本以继续保存。",
  );
  next = next.replace(
    /^Describe the (image|video|3D model) you want to create$/,
    (_, kind: string) =>
      `描述你想创建的${kind === "3D model" ? " 3D 模型" : kind === "image" ? "图片" : "视频"}`,
  );
  next = next.replace(
    /^((?:\d+)\/(?:\d+)) selected · Rigging and animation use provider credits$/,
    "$1 已选择 · 绑定和动画生成会消耗提供商额度",
  );
  next = next.replace(/^Move (.+)$/, "动作 $1");
  next = next.replace(
    /^No (image|video|3D model|animation) yet$/,
    (_, kind: string) =>
      `暂无${kind === "image" ? "图片" : kind === "video" ? "视频" : kind === "3D model" ? "3D 模型" : "动画"}`,
  );
  next = next.replace(
    /^Generating (image|video|3D model)\.\.\.$/,
    (_, kind: string) =>
      `正在生成${kind === "image" ? "图片" : kind === "video" ? "视频" : " 3D 模型"}……`,
  );
  next = next.replace(
    /^Generate (image|video|3D model)( again)?$/,
    (_, kind: string, again?: string) =>
      `生成${kind === "image" ? "图片" : kind === "video" ? "视频" : " 3D 模型"}${again ? "（再次）" : ""}`,
  );
  next = next.replace(
    /^Describe a (image|video|3D model) below, then generate$/,
    (_, kind: string) =>
      `在下方描述${kind === "image" ? "图片" : kind === "video" ? "视频" : " 3D 模型"}，然后生成`,
  );
  next = next.replace(/^Pause (.+)$/, "暂停$1");
  next = next.replace(/^Unmute (.+)$/, "取消静音$1");
  next = next.replace(/^Mute (.+)$/, "静音$1");
  next = next.replace(/^(.+) position$/, "$1位置");
  next = next.replace(/^(.+) polys$/, "$1 面");
  next = next.replace(/^Could not download: (.+)$/, "无法下载：$1");
  next = next.replace(/^Could not send asset: (.+)$/, "无法发送资源：$1");
  next = next.replace(/^Column (\d+) title$/, "第 $1 列标题");
  next = next.replace(/^Column (\d+) type$/, "第 $1 列类型");
  next = next.replace(/^Delete column (\d+)$/, "删除第 $1 列");
  next = next.replace(/^Resize column (\d+)$/, "调整第 $1 列宽度");
  next = next.replace(/^Delete row (\d+)$/, "删除第 $1 行");
  next = next.replace(/^Row (\d+), (.+)$/, "第 $1 行，$2");
  next = next.replace(/^Asset actions for (.+)$/, "资源操作：$1");
  next = next.replace(/^Board options: (.+)$/, "画板选项：$1");
  next = next.replace(/^Add “(.+)” to a project$/, "将“$1”添加到项目");
  next = next.replace(/^Added to (.+) as (.+)$/, "已添加到$1，位置：$2");
  next = next.replace(
    /^Delete \"(.+)\"\? Documents and Library assets will be kept\.$/,
    "删除“$1”吗？文档和资源库中的资源将会保留。",
  );
  next = next.replace(
    /^Connected (image|video|audio|model|3D model|Text node)$/,
    (_, kind: string) =>
      ({
        image: "已连接图片",
        video: "已连接视频",
        audio: "已连接音频",
        model: "已连接模型",
        "3D model": "已连接 3D 模型",
        "Text node": "已连接文本节点",
      })[kind] ?? `已连接${kind}`,
  );
  next = next.replace(/^(\d+) projects$/, "$1 个项目");
  next = next.replace(
    /^Delete (column|row) (\d+)$/,
    (_, kind: string, index: string) =>
      `${kind === "column" ? "删除列" : "删除行"} ${index}`,
  );
  next = next.replace(/^Resize column (\d+)$/, "调整列 $1 的宽度");
  return next;
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(readLanguage);
  useEffect(() => {
    applyLanguage(language);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.parentElement)
          applyLanguage(language, mutation.target.parentElement);
        if (mutation.type === "childList")
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE)
              applyLanguage(language, node as Element);
          });
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATED_ATTRIBUTES,
    });
    return () => observer.disconnect();
  }, [language]);

  useEffect(() => {
    const onLanguageChanged = (event: Event) =>
      updateLanguage((event as CustomEvent<Language>).detail);
    window.addEventListener(LANGUAGE_EVENT, onLanguageChanged);
    return () => window.removeEventListener(LANGUAGE_EVENT, onLanguageChanged);
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
