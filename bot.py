from typing import Optional
import nextcord
from nextcord import SlashOption
from nextcord.ext import commands
from dotenv import load_dotenv
from db.db import Projects, Blogs
import datetime
import os
import requests

load_dotenv()

bot = commands.Bot(command_prefix=["Mi!", "mi!"],
                   intents=nextcord.Intents.all())

status_mapping = {
    "In Progress": 1,
    "Completed": 2,
    "Not Maintained": 3,
    "Inactive": 4,
    "Active": 5
}

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
    await interaction.response.send_message(f"**Projects:**\n{response}")


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
    await interaction.response.send_message(f"**Blogs:**\n{response}")



@bot.slash_command(name="create_blog", description="Create a new blog")
async def create_blog(
    interaction,
    title: str,
    content: str = None,
    hero_image: str = None
):
    date = datetime.datetime.now().strftime("%Y-%m-%d")
    blog = Blogs.create(
        date=date,
        title=title,
        content=content,
        hero_image=hero_image
    )
    await interaction.response.send_message(f"Blog created: {blog.id} - {blog.title}")



@bot.slash_command(name="edit_blog", description="Edit an existing blog")
async def edit_blog(
    interaction,
    blog_id: int,
    title: str = None,
    content: str = None,
    hero_image: str = None
):
    blog = Blogs.get_or_none(Blogs.id == blog_id)
    if not blog:
        await interaction.response.send_message(f"Blog with ID {blog_id} not found.")
        return

    if title:
        blog.title = title
    if content:
        blog.content = content
    if hero_image:
        blog.hero_image = hero_image

    blog.save()
    await interaction.response.send_message(f"Blog {blog_id} updated successfully.")


@bot.slash_command(name="delete_blog", description="Delete a blog by ID")
async def delete_blog(
    interaction,
    blog_id: int
):
    blog = Blogs.get_or_none(Blogs.id == blog_id)
    if not blog:
        await interaction.response.send_message(f"Blog with ID {blog_id} not found.")
        return

    blog.delete_instance()
    await interaction.response.send_message(f"Blog {blog_id} - '{blog.title}' deleted successfully.")


bot.run(os.getenv("DISCORD_TOKEN"))