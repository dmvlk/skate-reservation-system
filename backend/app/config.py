from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # app
    app_name: str = "Skate Reservation System"
    app_env: str = "development"
    debug: bool = True

    # db
    database_url: str

    # cors
    cors_origins: str = ""

    # jwt
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    @property
    def cors_origins_list(self) -> list[str]:
        if not self.cors_origins:
            return []
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

settings = Settings()
