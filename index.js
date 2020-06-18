const Koa = require('koa');
const EJS = require('ejs');
const FS = require('fs');
const Path = require('path');

const Config = require('./config');
const MimeType = require('./lib/mimetype');
const Range = require('./lib/range');

const HttpServer = new Koa();

HttpServer.on('error', (error) => {
	if (error.code === 'ECONNRESET') {
		// console.warn('Koa app-level EPIPE error.', { error })
	} else {
		console.error('Koa app-level error', error)
	}
})

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

		// Probe
		const buffer = readFileSegment(entryPath, 0, 65536);

		return {
			type: 'file',
			path: entryPath,
			contentType: MimeType.getMimeType(buffer) || 'application/octet-stream',
			filename: Path.basename(entryPath),
			length: stats.size,
			lastModified: stats.mtime,
		}
	}

}

const readFileSegment = function (path, offset, length) {

	const fd = FS.openSync(path);

	const buffer = Buffer.alloc(length);
	const bytesRead	= FS.readSync(fd, buffer, 0, length, offset);

	FS.closeSync(fd);

	return buffer.slice(0, bytesRead);
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

const getFileContent = ({ctx, content, url}) => {
	let range = Range(ctx.headers.range, content.length);
	const response = ctx.response;

	response.type = content.contentType;
	// response.type = 'video/mp4';
	response.set('Content-disposition', 'attachment; filename=' + content.filename);
	response.set('Last-Modified', new Date(content.lastModified).toUTCString());
	response.set('Accept-Ranges', 'bytes');

	if (range)
	{
		response.set('Content-Range', `bytes ${range.start}-${range.end}/${range.totalLength}`);
		response.set('Content-Length', range.end - range.start + 1);
		response.set('Cache-Control', 'no-cache');
		response.status = 206;
		response.body = FS.createReadStream(content.path, {
			start: range.start,
			end: range.end,
		});
	}
	else
	{
		response.set('Content-Length', content.length);
		response.body = FS.createReadStream(content.path);
	}

	range = range || {
		start: 0,
		end: content.length,
		totalLength: content.length,
	}

	console.log(`${response.status || 200}\t${range.start}-${range.end}/${range.totalLength}\t${url}\t${ctx.req.headers['user-agent']}`);

	return;
}

HttpServer.use(async (ctx, next) => {

	const static = Config.statics[ctx.url];

	if (!static)
	{
		return next();
	}

	ctx.type = 'application/javascript';
	ctx.body = FS.createReadStream(static);
})


HttpServer.use(async ctx => {

	const url = decodeURI(ctx.path);
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
		if (ctx.query && 'play' in ctx.query)
		{
			getFileContent({
				ctx,
				content,
				url,
			});
			return;
		}
		else
		{
			response = await EJS.renderFile('./ejs/player.html', {
				title: Path.basename(url),
				url: Path.basename(url),
				type: content.contentType,
			}, {
				async: true,
			})
		}
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

console.log(`Started: http://localhost${Config.port != 80 ? Config.port : ''}`)