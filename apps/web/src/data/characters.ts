import type { Character } from '../types/kanban';
import catalog from './catalog.json';

export const CHARACTERS_DATABASE = catalog.characters as Character[];
