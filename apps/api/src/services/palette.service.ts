import type { Types } from 'mongoose';
import type { PaletteListQuery, PaletteListResponse } from '@styleme/contracts';
import type { AppearanceService } from './appearance.service';
import { listAllPalettes, rankPalettes, resolvePreferences, signalsFromAppearance, type StyleLibrary } from './engine';
import type { ProfileService } from './profile.service';

// Palettes for the palette page (FR-PAL-01 … 03): every approved palette (`view=all`), or the
// suggested order from the user's colour preferences and, only while enabled, their signals.
export class PaletteService {
  constructor(
    private readonly library: StyleLibrary,
    private readonly profiles: ProfileService,
    private readonly appearance: AppearanceService,
  ) {}

  async list(userId: Types.ObjectId, query: PaletteListQuery): Promise<PaletteListResponse> {
    if (query.view === 'all') return { palettes: listAllPalettes(this.library.palettes) };
    const [profile, appearance] = await Promise.all([this.profiles.get(userId), this.appearance.get(userId)]);
    const prefs = resolvePreferences(profile, signalsFromAppearance(appearance));
    return { palettes: rankPalettes(this.library.palettes, prefs) };
  }
}
