export default {
  log: {
    enterStep: '进入 Step {step}: {name}',
    backStep: '返回 Step {step}: {name}',
    customRounds: '自定义模拟轮数: {n} 轮',
    projectInit: '项目视图已初始化。',
    noPendingFiles: '未找到待上传文件。',
    noPendingFilesDetail: '错误：新建项目未找到待上传文件。',
    uploadingOntology: '开始生成本体：上传文件中…',
    ontologyProgress: '正在上传并分析文档…',
    ontologyFailed: '本体生成失败',
    ontologyGenError: '生成本体出错:',
    projectLoad: '正在加载项目 {id}…',
    projectLoaded: '项目已加载。状态: {status}',
    loadProjectError: '加载项目失败:',
    loadProjectException: '加载项目异常:',
    projectFailed: '项目失败',
    startingBuild: '开始构建图谱…',
    buildStarting: '构建启动中…',
    buildTaskStarted: '图谱构建任务已启动。任务 ID: {id}',
    buildStartError: '启动构建失败:',
    buildException: '构建异常:',
    pollingGraph: '已开始轮询图谱数据…',
    graphRefreshed: '图谱数据已刷新。节点: {nodes}，边: {edges}',
    taskProgress: '{msg}',
    buildCompleted: '图谱构建任务已完成。',
    buildFailed: '图谱构建任务失败: {error}',
    loadingGraph: '正在加载完整图谱数据: {id}',
    graphLoadedOk: '图谱数据加载成功。',
    graphLoadFailed: '加载图谱数据失败: {error}',
    graphLoadException: '加载图谱异常:',
    manualRefresh: '已手动触发图谱刷新。',
    graphPollingStopped: '图谱轮询已停止。'
  },
  error: {
    noPendingFiles: '未找到待上传文件。',
    ontologyFailed: '本体生成失败'
  }
}
