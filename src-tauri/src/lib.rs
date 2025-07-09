mod app_state;
use app_state::{AppState, Note};
use sqlx::migrate::MigrateDatabase;
use sqlx::{migrate::Migrator, sqlite::SqlitePoolOptions, Sqlite};
use std::path::PathBuf;
use tauri::{App, Manager, State};

static MIGRATOR: Migrator = sqlx::migrate!();

async fn setup_db(app: &App) -> sqlx::Result<AppState> {
    let mut path: PathBuf = app.path().app_data_dir().expect("failed to get data_dir");
    std::fs::create_dir_all(&path).expect("failed to create app data dir");
    path.push("notes.db");
    let db_url = format!("sqlite://{}", path.to_string_lossy());
    Sqlite::create_database(&db_url).await.ok();
    let db = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;
    MIGRATOR.run(&db).await?;
    Ok(AppState::new(db))
}

#[tauri::command]
async fn add_note(
    title: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<Note, String> {
    state
        .add_note(title, content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    state.get_all_notes().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_note(
    id: String,
    title: Option<String>,
    content: Option<String>,
    state: State<'_, AppState>,
) -> Result<Option<Note>, String> {
    state
        .update_note(&id, title, content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_note(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.delete_note(&id).await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            tauri::async_runtime::block_on(async {
                let state = setup_db(app).await.expect("DB init failed");
                app.manage(state);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            add_note,
            get_all_notes,
            update_note,
            delete_note
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
