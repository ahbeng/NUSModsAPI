import path from 'path';
import fs from 'fs-extra';
import { URL, URLSearchParams } from 'url';
import sanitizeFilename from 'sanitize-filename';
import axios from 'axios';
import bunyan from 'bunyan';

import config from '../../config';

const log = bunyan.createLogger({
  name: 'HttpService',
  level: process.env.NODE_ENV === 'production' ? bunyan.INFO : bunyan.DEBUG,
});

/**
 * Converts axios request configuration to equivalent valid filename.
 */
function getCacheFilePath(requestConfig) {
  const { baseURL, url, params } = requestConfig;
  // https://nodejs.org/docs/latest/api/url.html#url_url_strings_and_url_objects
  const { hostname, pathname, searchParams, href } = new URL(url, baseURL);

  const keyValuePairs = new Set();
  const addKeyValuePair = (value, key) => {
    keyValuePairs.add(`${key}=${value}`);
  };
  // URLSearchParams are iterables, not arrays (so no map, filter, etc)
  searchParams.forEach(addKeyValuePair);
  new URLSearchParams(params).forEach(addKeyValuePair);

  let filename = '';
  if (keyValuePairs.size) {
    filename = sanitizeFilename(Array.from(keyValuePairs).sort().join('&'));
    if (filename === '') {
      throw new Error(`Invalid filename for url ${href}`);
    }
  } else {
    filename = 'index.html';
  }

  return path.join(
    config.defaults.cachePath,
    hostname.replace(/^www\./, ''),
    pathname.replace(/\/index\.[a-z]+$/, ''),
    filename,
  );
}

/**
 * Gets the time the file was last modified if it exists, Infinity otherwise.
 */
async function getFileModifiedTime(cachedPath, urlStr) {
  try {
    const stats = await fs.stat(cachedPath);
    if (stats.isFile()) {
      return stats.mtime;
    }
    log.error(`${cachedPath} is not a file`);
  } catch (err) {
    log.debug(`no cached file for ${urlStr}`);
  }
  return Infinity;
}

const HttpService = axios.create({
  validateStatus: status => status >= 200 && (status < 300 && status !== 304),
});

/**
 * Return cached response when
 * 1) Cache file exists
 * 2) Cache file is within set cache limit
 *
 */
HttpService.interceptors.request.use(async (request) => {
  // Only cache GET requests
  if (request.method === 'get') {
    const { maxCacheAge = config.defaults.maxCacheAge } = request;

    const cachedFilePath = getCacheFilePath(request);
    const modifiedTime = await getFileModifiedTime(cachedFilePath, request.url);

    request.isCached = (modifiedTime - Date.now()) < maxCacheAge;
    if (request.isCached) {
      request.data = await fs.readFile(cachedFilePath, 'utf8');
      // Set the request adapter to send the cached response and prevent the request from actually running
      request.adapter = () => Promise.resolve({
        data: request.data,
        status: request.status,
        statusText: request.statusText,
        headers: request.headers,
        config: request,
        request,
      });
    }
  }
  return request;
});

/**
 * Cache response when
 * 1) Not cached already
 */
HttpService.interceptors.response.use((response) => {
  if (!response.config.isCached) {
    const cachedFilePath = getCacheFilePath(response.config);
    fs.outputFile(cachedFilePath, response.data);
  }
  return response;
});

export default HttpService;
export { getCacheFilePath, getFileModifiedTime };