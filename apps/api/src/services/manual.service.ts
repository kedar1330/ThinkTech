import type { ManualStep } from '@styleme/contracts';
import { DEFAULT_MANUAL_STEPS } from '../models/manual';
import type { Models } from '../models';

export class ManualService {
  constructor(private readonly models: Models) {}

  /**
   * Returns all manual steps ordered by sortOrder.
   * Ensures the manualSteps collection is synchronized with DEFAULT_MANUAL_STEPS.
   */
  async listSteps(): Promise<ManualStep[]> {
    await this.seedDefaults();

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
   * Seeds default steps into the manualSteps collection and keeps existing steps in sync.
   */
  async seedDefaults(): Promise<void> {
    for (const step of DEFAULT_MANUAL_STEPS) {
      await this.models.ManualStep.updateOne(
        { slug: step.slug },
        {
          $set: {
            stepNumber: step.stepNumber,
            title: step.title,
            tagline: step.tagline,
            description: step.description,
            actionLabel: step.actionLabel,
            actionHref: step.actionHref,
            imageUrl: step.imageUrl,
            imageAlt: step.imageAlt,
            highlights: step.highlights,
            category: step.category,
            status: step.status,
            sortOrder: step.sortOrder,
          },
        },
        { upsert: true },
      );
    }
  }
}
