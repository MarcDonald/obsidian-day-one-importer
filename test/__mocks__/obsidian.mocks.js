"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Plugin = exports.moment = exports.PluginSettingTab = exports.requestUrl = void 0;
exports.normalizePath = normalizePath;
var realMoment = require("moment");
var requestUrl = function (req) {
    return fetch(req).then(function (res) { return res.json(); });
};
exports.requestUrl = requestUrl;
var PluginSettingTab = /** @class */ (function () {
    function PluginSettingTab() {
    }
    return PluginSettingTab;
}());
exports.PluginSettingTab = PluginSettingTab;
exports.moment = realMoment;
function normalizePath(path) {
    return path;
}
// From https://github.com/anpigon/obsidian-tistory-plugin/blob/main/test/mocks/obsidian.ts
var Plugin = /** @class */ (function () {
    function Plugin() {
    }
    Plugin.prototype.addRibbonIcon = function (icon, title, callback) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.normalizePath = function (path) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.addStatusBarItem = function () {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.addCommand = function (command) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.addSettingTab = function (settingTab) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.registerView = function (type, viewCreator) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.registerExtensions = function (extensions, viewType) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.registerMarkdownPostProcessor = function (postProcessor, sortOrder) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.registerMarkdownCodeBlockProcessor = function (language, handler, sortOrder) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.registerCodeMirror = function (callback) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.registerEditorExtension = function (extension) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.registerObsidianProtocolHandler = function (action, handler) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.registerEditorSuggest = function (editorSuggest) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.loadData = function () {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.saveData = function (data) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.load = function () {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.onload = function () {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.unload = function () {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.onunload = function () {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.addChild = function (component) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.removeChild = function (component) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.register = function (cb) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.registerEvent = function (eventRef) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.registerDomEvent = function (el, type, callback, options) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.registerScopeEvent = function (keyHandler) {
        throw new Error('Method not implemented.');
    };
    Plugin.prototype.registerInterval = function (id) {
        throw new Error('Method not implemented.');
    };
    return Plugin;
}());
exports.Plugin = Plugin;
