const config = {
	'*.{ts,mjs,cjs}': ['eslint --fix', 'prettier --write'],
	'*.{css,md,yml,json}': ['prettier --write'],
};

export default config;
