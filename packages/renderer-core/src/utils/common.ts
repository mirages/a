/* eslint-disable no-new-func */
import Debug from 'debug';
import { isI18nData, RootSchema, NodeSchema, isJSExpression, JSSlot } from '@alilc/lowcode-types';
// moment对象配置
import _moment from 'moment';
import 'moment/locale/zh-cn';
import pkg from '../../package.json';

import { isEmpty } from 'lodash';

import _serialize from 'serialize-javascript';
import * as _jsonuri from 'jsonuri';

import IntlMessageFormat from 'intl-messageformat';

export const moment = _moment;
moment.locale('zh-cn');
(window as any).sdkVersion = pkg.version;

export { pick, isEqualWith as deepEqual, cloneDeep as clone, isEmpty, throttle, debounce } from 'lodash';
export const jsonuri = _jsonuri;
export const serialize = _serialize;

const ReactIs = require('react-is');
const ReactPropTypesSecret = require('prop-types/lib/ReactPropTypesSecret');
const factoryWithTypeCheckers = require('prop-types/factoryWithTypeCheckers');

const PropTypes2 = factoryWithTypeCheckers(ReactIs.isElement, true);

const EXPRESSION_TYPE = {
  JSEXPRESSION: 'JSExpression',
  JSFUNCTION: 'JSFunction',
  JSSLOT: 'JSSlot',
  JSBLOCK: 'JSBlock',
  I18N: 'i18n',
};

const hasSymbol = typeof Symbol === 'function' && Symbol.for;
const REACT_FORWARD_REF_TYPE = hasSymbol ? Symbol.for('react.forward_ref') : 0xead0;
const debug = Debug('utils:index');

const ENV = {
  TBE: 'TBE',
  WEBIDE: 'WEB-IDE',
  VSCODE: 'VSCODE',
  WEB: 'WEB',
};

/**
 * @name isSchema
 * @description 判断是否是模型结构
 */
export function isSchema(schema: any, ignoreArr = false): schema is NodeSchema {
  if (isEmpty(schema)) return false;
  // Leaf 组件也返回 true
  if (schema.componentName === 'Leaf' || schema.componentName === 'Slot') return true;
  if (!ignoreArr && Array.isArray(schema)) return schema.every((item) => isSchema(item));
  return !!(schema.componentName && schema.props && (typeof schema.props === 'object' || isJSExpression(schema.props)));
}

export function isFileSchema(schema: NodeSchema): schema is RootSchema {
  if (isEmpty(schema)) return false;
  return ['Page', 'Block', 'Component', 'Addon', 'Temp'].includes(schema.componentName);
}

// 判断当前页面是否被嵌入到同域的页面中
export function inSameDomain() {
  try {
    return window.parent !== window && window.parent.location.host === window.location.host;
  } catch (e) {
    return false;
  }
}

export function getFileCssName(fileName: string) {
  if (!fileName) return;
  const name = fileName.replace(/([A-Z])/g, '-$1').toLowerCase();
  return (`lce-${name}`)
    .split('-')
    .filter((p) => !!p)
    .join('-');
}

// 兼容乐高设计态 JSBlock 的老协议
export function isJSSlot(obj: any): obj is JSSlot {
  return obj && typeof obj === 'object' && ([EXPRESSION_TYPE.JSSLOT, EXPRESSION_TYPE.JSBLOCK].includes(obj.type));
}

/**
 * @name wait
 * @description 等待函数
 */
export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(() => resolve(true), ms));
}

export function curry(Comp: any, hocs = []) {
  return hocs.reverse().reduce((pre, cur: (pre: any) => any) => {
    return cur(pre);
  }, Comp);
}

export function getValue(obj: any, path: string, defaultValue = {}) {
  if (isEmpty(obj) || typeof obj !== 'object') return defaultValue;
  const res = path.split('.').reduce((pre, cur) => {
    return pre && pre[cur];
  }, obj);
  if (res === undefined) return defaultValue;
  return res;
}

// 更新obj的内容但不改变obj的指针
export function fillObj(receiver: any = {}, ...suppliers: any) {
  Object.keys(receiver).forEach((item) => {
    delete receiver[item];
  });
  Object.assign(receiver, ...suppliers);
  return receiver;
}

// 中划线转驼峰
export function toHump(name: string) {
  // eslint-disable-next-line no-useless-escape
  return name.replace(/\-(\w)/g, (_: any, letter: string) => {
    return letter.toUpperCase();
  });
}

// 驼峰转中划线
export function toLine(name: string) {
  return name.replace(/([A-Z])/g, '-$1').toLowerCase();
}

// 获取当前环境
export function getEnv() {
  const { userAgent } = navigator;
  const isVscode = /Electron\//.test(userAgent);
  if (isVscode) return ENV.VSCODE;
  const isTheia = (window as any).is_theia === true;
  if (isTheia) return ENV.WEBIDE;
  return ENV.WEB;
}

/**
 * 用于构造国际化字符串处理函数
 * @param {*} locale 国际化标识，例如 zh-CN、en-US
 * @param {*} messages 国际化语言包
 */
export function generateI18n(locale = 'zh-CN', messages: any = {}) {
  return (key: string, values = {}) => {
    if (!messages || !messages[key]) return '';
    const formater = new IntlMessageFormat(messages[key], locale);
    return formater.format(values);
  };
}

/**
 * 用于处理国际化字符串
 * @param {*} key 语料标识
 * @param {*} values 字符串模版变量
 * @param {*} locale 国际化标识，例如 zh-CN、en-US
 * @param {*} messages 国际化语言包
 */
export function getI18n(key: string, values = {}, locale = 'zh-CN', messages: Record<string, any> = {}) {
  if (!messages || !messages[locale] || !messages[locale][key]) return '';
  const formater = new IntlMessageFormat(messages[locale][key], locale);
  return formater.format(values);
}

/**
 * 判断当前组件是否能够设置ref
 * @param {*} Comp 需要判断的组件
 */
export function canAcceptsRef(Comp: any) {
  return Comp?.$$typeof === REACT_FORWARD_REF_TYPE || Comp?.prototype?.isReactComponent || Comp?.prototype?.setState || Comp._forwardRef;
}

/**
 * 黄金令箭埋点
 * @param {String} gmKey 为黄金令箭业务类型
 * @param {Object} params 参数
 * @param {String} logKey 属性串
 */
export function goldlog(gmKey: string, params = {}, logKey = 'other') {
  // vscode 黄金令箭API
  const sendIDEMessage = (window as any).sendIDEMessage || (inSameDomain() && (window.parent as any).sendIDEMessage);
  const goKey = serializeParams({
    sdkVersion: pkg.version,
    env: getEnv(),
    ...params,
  });
  if (sendIDEMessage) {
    sendIDEMessage({
      action: 'goldlog',
      data: {
        logKey: `/lce.core.${logKey}`,
        gmKey,
        goKey,
      },
    });
  }
  (window as any)?.goldlog?.record(`/lce.core.${logKey}`, gmKey, goKey, 'POST');
}

// utils为编辑器打包生成的utils文件内容，utilsConfig为数据库存放的utils配置
export function generateUtils(utils: any, utilsConfig: Array<{ name: string; type: string; content: any }>) {
  if (!Array.isArray(utilsConfig)) return { ...utils };
  const res: any = {};
  utilsConfig.forEach((item) => {
    if (!item.name || !item.type || !item.content) return;
    if (item.type === 'function' && typeof item.content === 'function') {
      res[item.name] = item.content;
    } else if (item.type === 'npm' && utils[item.name]) {
      res[item.name] = utils[item.name];
    }
  });
  return res;
}

// 将函数返回结果转成promise形式，如果函数有返回值则根据返回值的bool类型判断是reject还是resolve，若函数无返回值默认执行resolve
export function transformToPromise(input: any) {
  if (input instanceof Promise) return input;
  return new Promise((resolve, reject) => {
    if (input || input === undefined) {
      resolve({});
    } else {
      reject();
    }
  });
}

export function moveArrayItem(arr: any[], sourceIdx: number, distIdx: number, direction: 'after' | 'before') {
  if (
    !Array.isArray(arr) ||
    sourceIdx === distIdx ||
    sourceIdx < 0 ||
    sourceIdx >= arr.length ||
    distIdx < 0 ||
    distIdx >= arr.length
  ) return arr;
  const item = arr[sourceIdx];
  if (direction === 'after') {
    arr.splice(distIdx + 1, 0, item);
  } else {
    arr.splice(distIdx, 0, item);
  }
  if (sourceIdx < distIdx) {
    arr.splice(sourceIdx, 1);
  } else {
    arr.splice(sourceIdx + 1, 1);
  }
  return arr;
}

export function transformArrayToMap(arr: any[], key: string, overwrite = true) {
  if (isEmpty(arr) || !Array.isArray(arr)) return {};
  const res: any = {};
  arr.forEach((item) => {
    const curKey = item[key];
    if (item[key] === undefined) return;
    if (res[curKey] && !overwrite) return;
    res[curKey] = item;
  });
  return res;
}

export function checkPropTypes(value: any, name: string, rule: any, componentName: string) {
  if (typeof rule === 'string') {
    rule = new Function(`"use strict"; const PropTypes = arguments[0]; return ${rule}`)(PropTypes2);
  }
  if (!rule || typeof rule !== 'function') {
    console.warn('checkPropTypes should have a function type rule argument');
    return true;
  }
  const err = rule(
    {
      [name]: value,
    },
    name,
    componentName,
    'prop',
    null,
    ReactPropTypesSecret,
  );
  if (err) {
    console.warn(err);
  }
  return !err;
}

export function transformSchemaToPure(obj: any) {
  const pureObj = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map((item) => pureObj(item));
    } else if (typeof obj === 'object') {
      // 对于undefined及null直接返回
      if (!obj) return obj;
      const res: any = {};
      forEach(obj, (val: any, key: string) => {
        if (key.startsWith('__') && key !== '__ignoreParse') return;
        res[key] = pureObj(val);
      });
      return res;
    }
    return obj;
  };
  return pureObj(obj);
}

export function transformSchemaToStandard(obj: any) {
  const standardObj = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map((item) => standardObj(item));
    } else if (typeof obj === 'object') {
      // 对于undefined及null直接返回
      if (!obj) return obj;
      const res: any = {};
      forEach(obj, (val: any, key: string) => {
        if (key.startsWith('__') && key !== '__ignoreParse') return;
        if (isSchema(val) && key !== 'children' && obj.type !== 'JSSlot') {
          res[key] = {
            type: 'JSSlot',
            value: standardObj(val),
          };
          // table特殊处理
          if (key === 'cell') {
            res[key].params = ['value', 'index', 'record'];
          }
        } else {
          res[key] = standardObj(val);
        }
      });
      return res;
    } else if (typeof obj === 'function') {
      return {
        type: 'JSFunction',
        value: obj.toString(),
      };
    }
    return obj;
  };
  return standardObj(obj);
}

export function transformStringToFunction(str: string) {
  if (typeof str !== 'string') return str;
  if (inSameDomain() && (window.parent as any).__newFunc) {
    return (window.parent as any).__newFunc(`"use strict"; return ${str}`)();
  } else {
    return new Function(`"use strict"; return ${str}`)();
  }
}

export function parseData(schema: unknown, self: any): any {
  if (isJSExpression(schema)) {
    return parseExpression(schema, self);
  } else if (isI18nData(schema)) {
    return parseI18n(schema, self);
  } else if (typeof schema === 'string') {
    return schema.trim();
  } else if (Array.isArray(schema)) {
    return schema.map((item) => parseData(item, self));
  } else if (typeof schema === 'function') {
    return schema.bind(self);
  } else if (typeof schema === 'object') {
    // 对于undefined及null直接返回
    if (!schema) return schema;
    const res: any = {};
    forEach(schema, (val: any, key: string) => {
      if (key.startsWith('__')) return;
      res[key] = parseData(val, self);
    });
    return res;
  }
  return schema;
}

/* 全匹配{{开头,}}结尾的变量表达式，或者对象类型JSExpression，支持省略this */
export function parseExpression(str: any, self: any) {
  try {
    const contextArr = ['"use strict";', 'var __self = arguments[0];'];
    contextArr.push('return ');
    let tarStr;

    tarStr = (str.value || '').trim();
    tarStr = tarStr.replace(/this(\W|$)/g, (_a: any, b: any) => `__self${b}`);
    tarStr = contextArr.join('\n') + tarStr;
    // 默认调用顶层窗口的parseObj,保障new Function的window对象是顶层的window对象
    if (inSameDomain() && (window.parent as any).__newFunc) {
      return (window.parent as any).__newFunc(tarStr)(self);
    }
    const code = `with($scope || {}) { ${tarStr} }`;
    return new Function('$scope', code)(self);
  } catch (err) {
    debug('parseExpression.error', err, str, self);
    return undefined;
  }
}

// 首字母大写
export function capitalizeFirstLetter(word: string) {
  return word[0].toUpperCase() + word.slice(1);
}

export function isVariable(obj: any) {
  return obj && typeof obj === 'object' && obj?.type === 'variable';
}

/* 将 i18n 结构，降级解释为对 i18n 接口的调用 */
export function parseI18n(i18nInfo: any, self: any) {
  return parseExpression({
    type: EXPRESSION_TYPE.JSEXPRESSION,
    value: `this.i18n('${i18nInfo.key}')`,
  }, self);
}

export function forEach(obj: any, fn: any, context?: any) {
  obj = obj || {};
  Object.keys(obj).forEach(key => fn.call(context, obj[key], key));
}

export function shallowEqual(objA: any, objB: any) {
  if (objA === objB) {
    return true;
  }

  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    return false;
  }

  const keysA = Object.keys(objA);
  if (keysA.length !== Object.keys(objB).length) {
    return false;
  }

  for (let i = 0, key; i < keysA.length; i++) {
    key = keysA[i];
    if (!objB.hasOwnProperty(key) || objA[key] !== objB[key]) {
      return false;
    }
  }
  return true;
}

export function serializeParams(obj: any) {
  let rst: any = [];
  forEach(obj, (val: any, key: any) => {
    if (val === null || val === undefined || val === '') return;
    if (typeof val === 'object') rst.push(`${key}=${encodeURIComponent(JSON.stringify(val))}`);
    else rst.push(`${key}=${encodeURIComponent(val)}`);
  });
  return rst.join('&');
}