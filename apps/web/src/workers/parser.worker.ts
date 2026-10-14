import { expose } from 'comlink';
import { SDLParser } from '../parsers/sdl/SDLParser';

const api = {
  parseSDL(text: string) {
    return SDLParser.parse(text);
  },
};

export type ParserWorkerAPI = typeof api;

expose(api);
