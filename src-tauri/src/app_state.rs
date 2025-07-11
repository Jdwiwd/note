use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Pool, Sqlite};
use uuid::Uuid;

pub type Db = Pool<Sqlite>;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct AppState {
    pub db: Db,
}

impl AppState {
    // 创建新的应用状态实例
    pub fn new(db: Db) -> Self {
        AppState { db }
    }
}

impl AppState {
    // 添加新笔记到数据库
    pub async fn add_note(&self, title: String, content: String) -> sqlx::Result<Note> {
        let now = Utc::now();
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&title)
        .bind(&content)
        .bind(&now)
        .bind(&now)
        .execute(&self.db)
        .await?;

        Ok(Note {
            id,
            title,
            content,
            created_at: now,
            updated_at: now,
        })
    }

    // 从数据库获取所有笔记
    pub async fn get_all_notes(&self) -> sqlx::Result<Vec<Note>> {
        let notes = sqlx::query_as::<_, Note>("SELECT * FROM notes")
            .fetch_all(&self.db)
            .await?;
        Ok(notes)
    }

    // 更新指定ID的笔记（支持部分更新）
    pub async fn update_note(
        &self,
        id: &str,
        title: Option<String>,
        content: Option<String>,
    ) -> sqlx::Result<Option<Note>> {
        let note = sqlx::query_as::<_, Note>("SELECT * FROM notes WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;

        if let Some(mut note) = note {
            let now = Utc::now();
            if let Some(title) = title {
                note.title = title;
            }
            if let Some(content) = content {
                note.content = content;
            }
            note.updated_at = now;

            sqlx::query("UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?")
                .bind(&note.title)
                .bind(&note.content)
                .bind(&note.updated_at)
                .bind(id)
                .execute(&self.db)
                .await?;
            Ok(Some(note))
        } else {
            Ok(None)
        }
    }

    // 删除指定ID的笔记
    pub async fn delete_note(&self, id: &str) -> sqlx::Result<bool> {
        let result = sqlx::query("DELETE FROM notes WHERE id = ?")
            .bind(id)
            .execute(&self.db)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}
