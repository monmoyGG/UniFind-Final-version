import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export function NotFound() {
  return (
    <div className="page page-narrow">
      <div className="state-block raised">
        <div className="state-icon">
          <Compass size={26} />
        </div>
        <p className="mono-label accent">ERROR 404</p>
        <h2>This page could not be found.</h2>
        <p>
          The link may be out of date, or the report may have been resolved and removed from the
          network.
        </p>
        <div className="success-actions">
          <Link to="/dashboard" className="btn btn-primary">
            Go to dashboard
          </Link>
          <Link to="/browse" className="btn btn-ghost">
            Browse items
          </Link>
        </div>
      </div>
    </div>
  );
}
