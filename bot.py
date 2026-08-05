from typing import Optional
import nextcord
from nextcord import SlashOption
from nextcord.ext import commands
from dotenv import load_dotenv
from db.db import Projects, Blogs, Photography
import datetime
import os
import requests
import uuid

load_dotenv()

DISCORD_ADMIN_USER_IDS = {
    int(user_id) for user_id in os.getenv('DISCORD_ADMIN_USER_IDS', '').split(',')
    if user_id.strip().isdigit()
}

bot = commands.Bot(command_prefix=["Mi!", "mi!"],
                   intents=nextcord.Intents.all())

status_mapping = {
    "In Progress": 1,
    "Completed": 2,
    "Not Maintained": 3,
    "Inactive": 4,
    "Active": 5
}

async def require_admin(interaction):
    if interaction.user.id in DISCORD_ADMIN_USER_IDS:
        return True
    await interaction.response.send_message("You are not authorized to manage site content.", ephemeral=True)
    return False

@bot.event
async def on_ready():
    # add a status to the bot
    await bot.change_presence(activity=nextcord.Game(name="primitt.dev"))
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")

@bot.slash_command(name="projects", description="List all projects")
async def projects(interaction):
    all_projects = Projects.select()
    if not all_projects:
        await interaction.response.send_message("No projects found.")
        return

    response = "\n".join([
        f"{p.id}. {p.name} ({p.date}): {p.description or 'No description'}, {p.status}, {p.link or 'No link'}"
        for p in all_projects
    ])
    await interaction.response.send_message(f"```Projects: \n{response}```")


@bot.slash_command(name="create_project", description="Create a new project")
async def create_project(
    interaction,
    name: str,
    description: str,
    year: str,  # user enters the year
    status: str = SlashOption(
        name="status",
        description="Select project status",
        choices=list(status_mapping.keys())
    ),
    link: Optional[str] = None
):
    if not await require_admin(interaction):
        return
    project = Projects.create(
        name=name,
        description=description,
        link=link,
        date=year,
        status=status_mapping[status]
    )
    await interaction.response.send_message(
        f"Project created: {project.name} ({project.date}) with status {status_mapping[status]} ({status})"
    )


@bot.slash_command(name="delete_project", description="Delete an existing project by ID")
async def delete_project(
    interaction,
    project_id: int
):
    if not await require_admin(interaction):
        return
    project = Projects.get_or_none(Projects.id == project_id)
    if project:
        project.delete_instance()
        await interaction.response.send_message(f"Project ID {project_id} ('{project.name}') deleted successfully.")
    else:
        await interaction.response.send_message(f"Project with ID {project_id} not found.")


@bot.slash_command(name="edit_project", description="Edit an existing project by ID")
async def edit_project(
    interaction,
    project_id: int,
    new_name: str = None,
    description: str = None,
    link: str = None,
    year: str = None,  # user can update year
    status: str = SlashOption(
        name="status",
        description="Select new project status",
        choices=list(status_mapping.keys()),
        required=False
    )
):
    if not await require_admin(interaction):
        return
    project = Projects.get_or_none(Projects.id == project_id)
    if not project:
        await interaction.response.send_message(f"Project with ID {project_id} not found.")
        return

    if new_name:
        project.name = new_name
    if description:
        project.description = description
    if link:
        project.link = link
    if year:
        project.date = year
    if status:
        project.status = status_mapping[status]

    project.save()
    await interaction.response.send_message(
        f"Project ID {project_id} ('{project.name}' - {project.date}) updated successfully."
    )
@bot.slash_command(name="blogs", description="List all blogs")
async def blogs(interaction):
    all_blogs = Blogs.select()
    if not all_blogs:
        await interaction.response.send_message("No blogs found.")
        return

    response = "\n".join([f"{b.id}: {b.title} ({b.date})" for b in all_blogs])
    await interaction.response.send_message(f"```Blogs:\n{response}```")



@bot.slash_command(name="create_blog", description="Create a new blog")
async def create_blog(
    interaction,
    title: str,
    content: str = None,
    hero_image: str = None,
    file: nextcord.Attachment = None
):
    if not await require_admin(interaction):
        return
    # If no content is provided but a file is uploaded, use file content
    if content is None and file:
        try:
            # Read the file content as text
            file_content = await file.read()
            content = file_content.decode('utf-8')
                
        except UnicodeDecodeError:
            await interaction.response.send_message("Error: Could not read file as text. Please ensure the file is a text file.")
            return
        except Exception as e:
            await interaction.response.send_message(f"Error reading file: {str(e)}")
            return
    
    date = datetime.datetime.now().strftime("%Y-%m-%d")
    blog = Blogs.create(
        date=date,
        title=title,
        content=content,
        hero_image=hero_image,
        writer=interaction.user.name
    )
    
    file_info = f" (with file: {file.filename})" if file else ""
    await interaction.response.send_message(f"Blog created: {blog.id} - {blog.title}{file_info}")



@bot.slash_command(name="edit_blog", description="Edit an existing blog")
async def edit_blog(
    interaction,
    blog_id: int,
    title: str = None,
    content: str = None,
    hero_image: str = None,
    file: nextcord.Attachment = None
):
    if not await require_admin(interaction):
        return
    blog = Blogs.get_or_none(Blogs.id == blog_id)
    if not blog:
        await interaction.response.send_message(f"Blog with ID {blog_id} not found.")
        return

    # If no content is provided but a file is uploaded, use file content
    if content is None and file:
        try:
            # Read the file content as text
            file_content = await file.read()
            content = file_content.decode('utf-8')
                
        except UnicodeDecodeError:
            await interaction.response.send_message("Error: Could not read file as text. Please ensure the file is a text file.")
            return
        except Exception as e:
            await interaction.response.send_message(f"Error reading file: {str(e)}")
            return

    if title:
        blog.title = title
    if content:
        blog.content = content
    if hero_image:
        blog.hero_image = hero_image

    blog.save()
    
    file_info = f" (with file: {file.filename})" if file and content else ""
    await interaction.response.send_message(f"Blog {blog_id} updated successfully.{file_info}")


@bot.slash_command(name="delete_blog", description="Delete a blog by ID")
async def delete_blog(
    interaction,
    blog_id: int
):
    if not await require_admin(interaction):
        return
    blog = Blogs.get_or_none(Blogs.id == blog_id)
    if not blog:
        await interaction.response.send_message(f"Blog with ID {blog_id} not found.")
        return

    blog.delete_instance()
    await interaction.response.send_message(f"Blog {blog_id} - '{blog.title}' deleted successfully.")
@bot.slash_command(name="up_photography", description="Upload photos to a photography series")
async def up_photography(
    interaction,
    series: str,
    image: nextcord.Attachment,
    image_2: nextcord.Attachment = None,
    image_3: nextcord.Attachment = None,
    image_4: nextcord.Attachment = None,
    image_5: nextcord.Attachment = None,
    image_6: nextcord.Attachment = None,
    image_7: nextcord.Attachment = None,
    image_8: nextcord.Attachment = None,
    image_9: nextcord.Attachment = None,
    image_10: nextcord.Attachment = None,
    small_desc: str = None,
):
    if not await require_admin(interaction):
        return
    attachments = [
        attachment for attachment in [
            image, image_2, image_3, image_4, image_5,
            image_6, image_7, image_8, image_9, image_10,
        ] if attachment
    ]
    entries = []

    for attachment in attachments:
        filename = f"{uuid.uuid4().hex}_{os.path.basename(attachment.filename)}"
        await attachment.save(f"images/{filename}")
        entries.append(Photography.create(
            series=series,
            image=filename,
            small_desc=small_desc,
        ))

    await interaction.response.send_message(
        f"Created {len(entries)} photography entries in '{series}': "
        + ", ".join(str(entry.id) for entry in entries)
    )

@bot.slash_command(name="delete_photography", description="Delete a photography entry by ID")
async def delete_photography(
    interaction,
    photography_id: int
):
    if not await require_admin(interaction):
        return
    photography_entry = Photography.get_or_none(Photography.id == photography_id)
    if not photography_entry:
        await interaction.response.send_message(f"Photography entry with ID {photography_id} not found.")
        return

    image_path = f"images/{photography_entry.image}"
    if os.path.exists(image_path):
        os.remove(image_path)

    photography_entry.delete_instance()
    await interaction.response.send_message(f"Photography entry {photography_id} - '{photography_entry.series}' deleted successfully.")

@bot.slash_command(name="list_photography", description="List all photography entries by series")
async def list_photography(
    interaction,
    series: str = SlashOption(
        name="series",
        description="Select a series",
        choices=list(set(entry.series for entry in Photography.select())),
        required=True
    )
):
    entries = Photography.select().where(Photography.series == series)
    if not entries:
        await interaction.response.send_message(f"No photography entries found for series '{series}'.")
        return

    response = "\n".join([f"{entry.id}: {entry.image} - {entry.small_desc or 'No description'}" for entry in entries])
    await interaction.response.send_message(f"```Photography entries for series '{series}':\n{response}```")

@bot.slash_command(name="list_series", description="List all unique photography series")
async def list_series(interaction):
    series_list = set(entry.series for entry in Photography.select())
    if not series_list:
        await interaction.response.send_message("No photography series found.")
        return

    response = "\n".join(series_list)
    await interaction.response.send_message(f"```Photography series:\n{response}```")
bot.run(os.getenv("DISCORD_TOKEN"))
