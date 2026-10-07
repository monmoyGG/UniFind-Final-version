import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import { matchService } from "@/services/matchService";
import { messageService } from "@/services/messageService";
import { PageHeader } from "@/components/common/PageHeader";
import { MatchCard } from "@/components/matches/MatchCard";
import { EmptyState, ErrorMessage, LoadingSpinner } from "@/components/common/Feedback";
import TiltedCard from "@/components/reactbits/TiltedCard";
import { ITEM_PLACEHOLDER } from "@/constants";

/** Smart Matching results — the standout feature. */
export function Matches() {
  const { data, loading, error, reload } = useApi(signal => matchService.list(signal), []);
  const navigate = useNavigate();

  const matches = data ?? [];
  // The highest-scoring pair leads the page as a featured card.
  const lead = matches[0];

  async function contact(itemId: number) {
    try {
      const conversation = await messageService.start(itemId);
      navigate(`/messages/${conversation.id}`);
    } catch (startError) {
      toast.error((startError as Error).message);
    }
  }

  return (
    <div className="page uf-tilted">
      <PageHeader
        eyebrow="RULE-BASED SMART MATCHING"
        title="Possible matches."
        description="UniFind compares category, title, color, brand, place, and timing — then shows you the evidence. It never decides who owns an item."
      />

      {error ? (
        <ErrorMessage message={error} onRetry={reload} />
      ) : loading ? (
        <LoadingSpinner label="Comparing report details…" />
      ) : matches.length > 0 ? (
        <div className="match-list">
          {lead && (
            <div className="match-lead">
              <TiltedCard
                imageSrc={lead.matched_item.image_url || ITEM_PLACEHOLDER}
                altText={lead.matched_item.title}
                captionText={`${lead.score}% · POSSIBLE MATCH`}
                containerHeight="200px"
                containerWidth="100%"
                imageHeight="200px"
                imageWidth="100%"
                rotateAmplitude={6}
                scaleOnHover={1.03}
                showMobileWarning={false}
                showTooltip
              />
              <div className="match-lead-copy">
                <p className="mono-label accent">STRONGEST SUGGESTION</p>
                <h2>{lead.matched_item.title}</h2>
                <p>
                  Lines up with your report of <strong>{lead.own_item.title}</strong> on{" "}
                  {lead.reasons.length} signal{lead.reasons.length === 1 ? "" : "s"}. The full
                  evidence is below — UniFind never decides who owns an item.
                </p>
              </div>
            </div>
          )}

          {matches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              onContact={() => contact(match.matched_item.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No possible matches yet."
          description="When another report shares enough structured details with one of yours, it will appear here for review."
          action="Browse active reports"
          href="/browse"
        />
      )}
    </div>
  );
}
