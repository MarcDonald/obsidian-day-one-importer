/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jest-environment jsdom
 */
// @ts-nocheck
import * as obsidian from 'obsidian';
import * as realMoment from 'moment';

export const requestUrl: typeof obsidian.requestUrl = (req) => {
	return fetch(req as never).then((res) => res.json() as any);
};

export class PluginSettingTab implements obsidian.PluginSettingTab {}

export const moment = realMoment;
export function normalizePath(path: string) {
	return path;
}

// From https://github.com/anpigon/obsidian-tistory-plugin/blob/main/test/mocks/obsidian.ts
export class Plugin implements obsidian.Plugin {
	app: obsidian.App;
	manifest: obsidian.PluginManifest;
	addRibbonIcon(
		icon: string,
		title: string,
		callback: (evt: MouseEvent) => any
	): HTMLElement {
		throw new Error('Method not implemented.');
	}
	normalizePath(path: string): string {
		throw new Error('Method not implemented.');
	}
	addStatusBarItem(): HTMLElement {
		throw new Error('Method not implemented.');
	}
	addCommand(command: obsidian.Command): obsidian.Command {
		throw new Error('Method not implemented.');
	}
	addSettingTab(settingTab: obsidian.PluginSettingTab): void {
		throw new Error('Method not implemented.');
	}
	registerView(type: string, viewCreator: obsidian.ViewCreator): void {
		throw new Error('Method not implemented.');
	}
	registerExtensions(extensions: string[], viewType: string): void {
		throw new Error('Method not implemented.');
	}
	registerMarkdownPostProcessor(
		postProcessor: obsidian.MarkdownPostProcessor,
		sortOrder?: number | undefined
	): obsidian.MarkdownPostProcessor {
		throw new Error('Method not implemented.');
	}
	registerMarkdownCodeBlockProcessor(
		language: string,
		handler: (
			source: string,
			el: HTMLElement,
			ctx: obsidian.MarkdownPostProcessorContext
		) => void | Promise<any>,
		sortOrder?: number | undefined
	): obsidian.MarkdownPostProcessor {
		throw new Error('Method not implemented.');
	}
	registerCodeMirror(callback: (cm: Editor) => any): void {
		throw new Error('Method not implemented.');
	}
	registerEditorExtension(extension: any): void {
		throw new Error('Method not implemented.');
	}
	registerObsidianProtocolHandler(
		action: string,
		handler: obsidian.ObsidianProtocolHandler
	): void {
		throw new Error('Method not implemented.');
	}
	registerEditorSuggest(editorSuggest: obsidian.EditorSuggest<any>): void {
		throw new Error('Method not implemented.');
	}
	loadData(): Promise<any> {
		throw new Error('Method not implemented.');
	}
	saveData(data: any): Promise<void> {
		throw new Error('Method not implemented.');
	}
	load(): void {
		throw new Error('Method not implemented.');
	}
	onload(): void {
		throw new Error('Method not implemented.');
	}
	unload(): void {
		throw new Error('Method not implemented.');
	}
	onunload(): void {
		throw new Error('Method not implemented.');
	}
	addChild<T extends obsidian.Component>(component: T): T {
		throw new Error('Method not implemented.');
	}
	removeChild<T extends obsidian.Component>(component: T): T {
		throw new Error('Method not implemented.');
	}
	register(cb: () => any): void {
		throw new Error('Method not implemented.');
	}
	registerEvent(eventRef: obsidian.EventRef): void {
		throw new Error('Method not implemented.');
	}
	registerDomEvent<K extends keyof WindowEventMap>(
		el: Window,
		type: K,
		callback: (this: HTMLElement, ev: WindowEventMap[K]) => any,
		options?: boolean | AddEventListenerOptions | undefined
	): void;
	registerDomEvent<K extends keyof DocumentEventMap>(
		el: Document,
		type: K,
		callback: (this: HTMLElement, ev: DocumentEventMap[K]) => any,
		options?: boolean | AddEventListenerOptions | undefined
	): void;
	registerDomEvent<K extends keyof HTMLElementEventMap>(
		el: HTMLElement,
		type: K,
		callback: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
		options?: boolean | AddEventListenerOptions | undefined
	): void;
	registerDomEvent(
		el: unknown,
		type: unknown,
		callback: unknown,
		options?: unknown
	): void {
		throw new Error('Method not implemented.');
	}
	registerScopeEvent(keyHandler: obsidian.KeymapEventHandler): void {
		throw new Error('Method not implemented.');
	}
	registerInterval(id: number): number {
		throw new Error('Method not implemented.');
	}
}
