from . import activities, approvals, audit, calculations, evidence, periods, reports

ALL = [
    activities.router,
    calculations.router,
    approvals.router,
    periods.router,
    reports.router,
    evidence.router,
    audit.router,
]
