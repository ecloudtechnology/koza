"""FastAPI bağımlılıkları."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from .auth import TenantContext, get_tenant_context
from .repo import Repository


def get_repo(request: Request) -> Repository:
    return request.app.state.repo


def _ctx(request: Request) -> TenantContext:
    return get_tenant_context(request)


Repo = Annotated[Repository, Depends(get_repo)]
Ctx = Annotated[TenantContext, Depends(_ctx)]
