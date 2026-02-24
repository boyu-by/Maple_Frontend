
/**
 * @typedef {Object} Node
 * @property {string} id - 唯一标识
 * @property {string} text - 节点显示的文本
 * @property {number} x - 画布坐标 X
 * @property {number} y - 画布坐标 Y
 * @property {number} width - 节点宽度（可根据文本动态计算，初期固定）
 * @property {number} height - 节点高度
 * @property {string|null} parentId - 父节点ID，根节点为null
 * @property {string[]} children - 子节点ID列表
 * @property {boolean} collapsed - 是否折叠子节点
 */

/**
 * @typedef {Object} MindMapData
 * @property {Object.<string, Node>} nodes - 以id为key的节点映射
 * @property {string[]} rootIds - 根节点ID数组
 */