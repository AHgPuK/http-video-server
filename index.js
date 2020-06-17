const Koa = require('koa');
const EJS = require('ejs');
const FS = require('fs');
const Path = require('path');

const Config = require('./config');

const HttpServer = new Koa();


const getRoot = () => {
	const public = Config.public || [];
	const list = public.map((item) => {
		return {
			name: item.name,
			type: item.type,
		}
	});

	return {
		type: 'list',
		content: list,
	};
}

const getPublicEntry = (name) => {

	const public = Config.public || [];

	for (let i = 0; i < public.length; i++)
	{
		const item = public[i];

		if (item.name == name)
		{
			return Path.resolve(item.entry);
		}
	}

	return null;
}

const error404 = function (path) {
	return {
		path: path,
		type: 'error',
		error: 404,
		content: '<h1>404 - Not Found</h1>',
	}
}

const resolvePath = (path) => {

	const pathElems = path.split('/');

	const firstDir = pathElems[1];

	const firstDirEntry = getPublicEntry(firstDir);

	if (!firstDirEntry)
	{
		return error404(path);
	}

	const restPath = pathElems.slice(2).join('/');
	const entryPath = Path.resolve(firstDirEntry, restPath);

	if (entryPath.length < firstDirEntry.length)
	{
		return error404(path);
	}

	const stats = FS.statSync(entryPath);

	if (stats.isDirectory())
	{
		return {
			title: path,
			type: 'list',
			content: getDirContent(entryPath),
		}
	}
	else {
		return {
			type: 'file',
			path: entryPath,
		}
	}

}

const getDirContent = (path) => {

	const content = FS.readdirSync(path, {
		withFileTypes: true,
	});

	return content.map(item => {
		return {
			name: item.name,
			type: item.isDirectory() ? 'dir' : 'file',
		}
	})

}

const getContent = (path) => {
	if (path == '/')
	{
		return getRoot();
	}

	const resolvedPath = resolvePath(path);

	if (resolvedPath)
	{
		return resolvedPath;
	}

	return error404(path);
}



HttpServer.use(async ctx => {

	const url = decodeURIComponent(ctx.url);
	const content = getContent(url);

	let response = '';

	if (content.type == 'list')
	{
		response = await EJS.renderFile('./ejs/listing.html', {
			title: url,
			list: content.content,
		}, {
			async: true,
		})
	}
	else if (content.type == 'file')
	{
		ctx.response.body = FS.createReadStream(content.path);
		console.log(`${ctx.status || 200} ${url}`);
		return;
	}
	else if (content.type == 'error')
	{
		response = content.content;
		ctx.status = content.error;
	}

	ctx.body = response;

	console.log(`${ctx.status || 200} ${url}`);

});

HttpServer.listen(Config.port);

console.log(`Started on port ${Config.port}`);