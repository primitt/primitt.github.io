from peewee import *

database = SqliteDatabase('db/db.db')

class BaseModel(Model):
    class Meta:
        database = database

class Projects(BaseModel):
    id = AutoField()
    date = TextField()
    name = TextField()
    description = TextField(null=True)
    link = TextField(null=True)
    status = IntegerField()

    class Meta:
        table_name = 'projects'
        primary_key = False
class Blogs(BaseModel):
    id = AutoField()
    date = TextField()
    hero_image = TextField(null=True)
    title = TextField()
    content = TextField(null=True)


    class Meta:
        table_name = 'blogs'
        primary_key = False


if __name__ == '__main__':
    database.connect()
    database.create_tables([Projects, Blogs])
    database.close()
    print("Tables created successfully.")