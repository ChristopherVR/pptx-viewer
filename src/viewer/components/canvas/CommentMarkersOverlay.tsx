/**
 * Comment marker dots rendered on top of the slide canvas.
 */
import type { PptxComment } from "../../../core";
import { getCommentMarkerPosition } from "../../utils";
import type { CanvasSize } from "../../types";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CommentMarkersOverlayProps {
  comments: PptxComment[];
  canvasSize: CanvasSize;
  onCommentMarkerClick?: (commentId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CommentMarkersOverlay({
  comments,
  canvasSize,
  onCommentMarkerClick,
}: CommentMarkersOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-[45]">
      {comments.map((comment, idx) => {
        const pos = getCommentMarkerPosition(
          comment,
          idx,
          canvasSize.width,
          canvasSize.height,
        );
        return (
          <div
            key={comment.id}
            className="absolute pointer-events-auto cursor-pointer"
            style={{
              left: pos.x - 10,
              top: pos.y - 10,
              width: 20,
              height: 20,
              borderRadius: "50%",
              backgroundColor: "rgba(255, 165, 0, 0.9)",
              border: "2px solid #fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1,
            }}
            title={`${comment.author ?? "Comment"}: ${comment.text}`}
            onClick={(e) => {
              e.stopPropagation();
              onCommentMarkerClick?.(comment.id);
            }}
          >
            {idx + 1}
          </div>
        );
      })}
    </div>
  );
}
