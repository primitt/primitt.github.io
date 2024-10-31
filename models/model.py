from peewee import *

database = SqliteDatabase('models/db.db')

class BaseModel(Model):
    class Meta:
        database = database

class Projects(BaseModel):
    date = TextField(null=True)
    description = TextField(null=True)
    gh_contribs = AnyField(null=True)  # ANY
    name = TextField(null=True)

    class Meta:
        table_name = 'projects'
        primary_key = False