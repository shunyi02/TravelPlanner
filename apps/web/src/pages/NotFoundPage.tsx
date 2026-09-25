import { Link } from 'react-router-dom';

/** Catch-all route: an unknown URL gets a way back instead of an empty pane. */
export function NotFoundPage() {
  return (
    <div className="main main-centered not-found">
      <h1 className="page-title">Page not found</h1>
      <p className="not-found-body">
        This address doesn't match any page in Cuti. Check the link, or head back to your trips.
      </p>
      <Link to="/" className="btn">
        Back to your trips
      </Link>
    </div>
  );
}
