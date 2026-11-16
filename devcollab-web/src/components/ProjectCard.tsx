import { Link } from 'react-router-dom'
import type { Project } from '../api'
import { timeAgo } from '../format'
import { Tags } from './ui'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link to={`/projects/${project.id}`} className="card project-card">
      <div className="project-card-head">
        <span className="project-name">
          <span className="muted">{project.ownerName} /</span> {project.name}
        </span>
        {project.openPullRequests > 0 && <span className="badge pr-open">{project.openPullRequests} PR</span>}
      </div>
      <p className="muted clamp">{project.description}</p>
      <Tags items={project.technologies} />
      <div className="muted small meta">
        <span>{project.contributors.length + 1} membre(s)</span>
        <span>·</span>
        <span>créé {timeAgo(project.createdAt)}</span>
      </div>
    </Link>
  )
}
