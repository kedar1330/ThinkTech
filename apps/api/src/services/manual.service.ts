import type { ManualStep } from '@styleme/contracts';
import { DEFAULT_MANUAL_STEPS } from '../models/manual';
import type { Models } from '../models';

export class ManualService {
  constructor(private readonly models: Models) {}

  /**
   * Returns all manual steps ordered by sortOrder.
   * If the manualSteps collection is unseeded, it initializes it with DEFAULT_MANUAL_STEPS.
   */
  async listSteps(): Promise<ManualStep[]> {
    const count = await this.models.ManualStep.countDocuments();
    if (count === 0) {
      await this.seedDefaults();
    }

    const docs = await this.models.ManualStep.find().sort({ sortOrder: 1 }).lean();
    return docs.map((doc) => ({
      id: String(doc._id),
      stepNumber: doc.stepNumber,
      slug: doc.slug,
      title: doc.title,
      tagline: doc.tagline,
      description: doc.description,
      actionLabel: doc.actionLabel,
      actionHref: doc.actionHref,
      imageUrl: doc.imageUrl,
      imageData: doc.imageData ?? undefined,
      imageAlt: doc.imageAlt,
      highlights: doc.highlights ?? [],
      category: doc.category,
      status: doc.status as 'live' | 'preview',
      sortOrder: doc.sortOrder,
    }));
  }

  /**
   * Seeds default steps into the manualSteps collection.
   */
  async seedDefaults(): Promise<void> {
    for (const step of DEFAULT_MANUAL_STEPS) {
      await this.models.ManualStep.updateOne({ slug: step.slug }, { $setOnInsert: step }, { upsert: true });
    }
  }
}
