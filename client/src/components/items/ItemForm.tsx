import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { CATEGORIES, LOCATIONS, OTHER_LOCATION, toDateInputValue } from "@/constants";
import { itemSchema, resolveLocation, type ItemValues } from "@/lib/schemas";
import { ImageUploader } from "@/components/common/ImageUploader";
import { FieldError } from "@/components/common/Feedback";
import type { ItemPayload } from "@/services/itemService";
import type { Item, ItemType } from "@/types";

/**
 * One reusable form for /report/lost, /report/found, and /items/:id/edit.
 * Only the wording changes with `mode`.
 *
 * React Hook Form keeps the inputs uncontrolled, so typing in a long form does
 * not re-render the whole thing, and `itemSchema` is the single description of
 * what a valid report looks like.
 */
export function ItemForm({
  mode,
  initial,
  submitLabel,
  submitting,
  onSubmit,
}: {
  mode: ItemType;
  initial?: Item;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (payload: ItemPayload) => Promise<void> | void;
}) {
  const initialIsPreset = initial ? LOCATIONS.includes(initial.location as never) : true;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ItemValues>({
    resolver: zodResolver(itemSchema),
    // Re-validate as the member fixes a field, but do not shout while they are
    // still filling the form in for the first time.
    mode: "onTouched",
    defaultValues: {
      title: initial?.title ?? "",
      category: (initial?.category as ItemValues["category"]) ?? undefined,
      description: initial?.description ?? "",
      locationChoice: initial
        ? ((initialIsPreset ? initial.location : OTHER_LOCATION) as ItemValues["locationChoice"])
        : undefined,
      customLocation: initial && !initialIsPreset ? initial.location : "",
      date: initial ? toDateInputValue(initial.date_lost_found) : toDateInputValue(new Date()),
      brand: initial?.brand ?? "",
      color: initial?.color ?? "",
      model: initial?.model ?? "",
      identifying: initial?.identifying_details ?? "",
      imageUrl: initial?.image_url ?? null,
    },
  });

  const locationChoice = watch("locationChoice");
  const dateLabel = mode === "lost" ? "Date lost" : "Date found";

  // Bring the first problem into view, the same way the hand-rolled version did.
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    document.querySelector(".field-error")?.scrollIntoView({ block: "center" });
  }, [errors]);

  async function submit(values: ItemValues) {
    await onSubmit({
      type: mode,
      title: values.title.trim(),
      category: values.category,
      description: values.description.trim(),
      location: resolveLocation(values),
      date_lost_found: new Date(values.date).toISOString(),
      image_url: values.imageUrl,
      brand: values.brand?.trim() || null,
      color: values.color?.trim() || null,
      model: values.model?.trim() || null,
      identifying_details: values.identifying?.trim() || null,
    });
  }

  const busy = submitting || isSubmitting;

  return (
    <form className="item-form" onSubmit={handleSubmit(submit)} noValidate>
      <fieldset className="form-section raised">
        <legend>
          <span className="mono-label accent">01 / THE BASICS</span>
          <h2>What {mode === "lost" ? "did you lose" : "did you find"}?</h2>
        </legend>

        <label className="field">
          <span>
            Item name <em>required</em>
          </span>
          <input
            className="recessed"
            maxLength={180}
            placeholder={mode === "lost" ? "e.g. Black iPhone 14" : "e.g. Navy blue backpack"}
            {...register("title")}
          />
          <FieldError message={errors.title?.message} />
        </label>

        <div className="field-row">
          <label className="field">
            <span>
              Category <em>required</em>
            </span>
            <select className="recessed" defaultValue="" {...register("category")}>
              <option value="">Select a category</option>
              {CATEGORIES.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <FieldError message={errors.category?.message} />
          </label>

          <label className="field">
            <span>
              {dateLabel} <em>required</em>
            </span>
            <input
              className="recessed"
              type="date"
              max={toDateInputValue(new Date())}
              {...register("date")}
            />
            <FieldError message={errors.date?.message} />
          </label>
        </div>

        <label className="field">
          <span>
            Where on campus? <em>required</em>
          </span>
          <select className="recessed" defaultValue="" {...register("locationChoice")}>
            <option value="">Select a location</option>
            {LOCATIONS.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {locationChoice === OTHER_LOCATION && (
            <input
              className="recessed mt-8"
              maxLength={180}
              placeholder="Describe the place, e.g. Bus bay near Gate 2"
              {...register("customLocation")}
            />
          )}
          <FieldError message={errors.locationChoice?.message ?? errors.customLocation?.message} />
        </label>

        <label className="field">
          <span>
            Description <em>required</em>
          </span>
          <textarea
            className="recessed"
            rows={4}
            maxLength={5000}
            placeholder="Describe it the way someone else would recognise it…"
            {...register("description")}
          />
          <FieldError message={errors.description?.message} />
        </label>
      </fieldset>

      <fieldset className="form-section raised">
        <legend>
          <span className="mono-label accent">02 / DETAILS THAT HELP MATCHING</span>
          <h2>Optional, but they sharpen the signal.</h2>
        </legend>

        <div className="field-row">
          <label className="field">
            <span>Brand</span>
            <input className="recessed" maxLength={100} placeholder="e.g. Samsung" {...register("brand")} />
          </label>
          <label className="field">
            <span>Color</span>
            <input className="recessed" maxLength={80} placeholder="e.g. Black" {...register("color")} />
          </label>
        </div>

        <label className="field">
          <span>Model</span>
          <input className="recessed" maxLength={120} placeholder="e.g. Galaxy S24" {...register("model")} />
        </label>

        <label className="field">
          <span>
            Additional identifying details <em className="private">private to you</em>
          </span>
          <textarea
            className="recessed"
            rows={3}
            maxLength={3000}
            placeholder="A scratch, a sticker, what's inside… kept off the public listing."
            {...register("identifying")}
          />
          <p className="field-hint">
            Only you can see this. Keep one or two details back so a real owner can prove the item is
            theirs during a claim.
          </p>
        </label>
      </fieldset>

      <fieldset className="form-section raised">
        <legend>
          <span className="mono-label accent">03 / PHOTO</span>
          <h2>A picture makes it recognisable.</h2>
        </legend>
        {/* ImageUploader owns its own upload flow and hands back a URL, so it is
            wired through Controller rather than a plain register(). */}
        <Controller
          control={control}
          name="imageUrl"
          render={({ field }) => <ImageUploader value={field.value} onChange={field.onChange} />}
        />
      </fieldset>

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "Saving…" : submitLabel} <ArrowRight size={17} />
      </button>
    </form>
  );
}
